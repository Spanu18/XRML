import * as THREE from 'three'
import { getStage } from '../core/stage.ts'

let hiddenTags: HTMLStyleElement | null = null

/**
 * Keeps the source element out of the 2D layout.
 *
 * Spatial elements stay in the real DOM — they're the config, the event target,
 * and what a screen reader or a querySelector sees — but the scene owns all
 * actual rendering.
 */
function hideTag(tag: string): void {
  if (!hiddenTags) {
    hiddenTags = document.createElement('style')
    document.head.appendChild(hiddenTags)
  }
  hiddenTags.append(`${tag}{display:none}`)
}

export function defineElement(
  tag: string,
  constructor: CustomElementConstructor,
): void {
  if (customElements.get(tag)) return
  hideTag(tag)
  customElements.define(tag, constructor)
}

const rotationScratch = new THREE.Vector3()

/** Reads an `"x y z"` attribute, falling back per-component on bad input. */
function readVector(
  element: HTMLElement,
  name: string,
  target: THREE.Vector3,
  fallback: number,
): void {
  const raw = element.getAttribute(name)
  if (!raw) {
    target.setScalar(fallback)
    return
  }

  const parts = raw.trim().split(/\s+/).map(Number)
  target.set(
    Number.isFinite(parts[0]) ? parts[0] : fallback,
    Number.isFinite(parts[1]) ? parts[1] : fallback,
    Number.isFinite(parts[2]) ? parts[2] : fallback,
  )
}

/**
 * Base class for spatial elements.
 *
 * Subclasses implement `build`/`teardown`; this class owns the group, the
 * transform attributes, and the invalidation that keeps the scene in step with
 * the DOM when attributes or text change.
 */
export abstract class XRElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['class', 'position', 'rotation', 'scale']
  }

  protected readonly object = new THREE.Group()

  private observer: MutationObserver | null = null
  private rebuildQueued = false
  private built = false

  connectedCallback(): void {
    getStage().scene.add(this.object)
    this.applyTransform()
    this.build()
    this.built = true

    // Text content changes don't surface as attribute mutations, so watch for
    // them directly — editing a label should behave like editing any other DOM.
    this.observer = new MutationObserver(() => this.invalidate())
    this.observer.observe(this, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = null

    if (this.built) {
      this.teardown()
      this.built = false
    }
    this.object.removeFromParent()
  }

  attributeChangedCallback(name: string): void {
    // Fires during upgrade too, before there's anything to update.
    if (!this.built) return
    if (name === 'class') this.invalidate()
    else this.applyTransform()
  }

  /** Coalesces repeated changes into one rebuild per microtask. */
  protected invalidate(): void {
    if (!this.built || this.rebuildQueued) return
    this.rebuildQueued = true

    queueMicrotask(() => {
      this.rebuildQueued = false
      if (!this.built) return
      this.teardown()
      this.build()
    })
  }

  protected applyTransform(): void {
    readVector(this, 'position', this.object.position, 0)
    readVector(this, 'scale', this.object.scale, 1)

    // Degrees, following the convention A-Frame set — radians in markup would
    // be needlessly hostile.
    readVector(this, 'rotation', rotationScratch, 0)
    this.object.rotation.set(
      THREE.MathUtils.degToRad(rotationScratch.x),
      THREE.MathUtils.degToRad(rotationScratch.y),
      THREE.MathUtils.degToRad(rotationScratch.z),
    )
  }

  /** Text content, whitespace-collapsed the way HTML would render it. */
  protected get label(): string {
    return (this.textContent ?? '').replace(/\s+/g, ' ').trim()
  }

  protected abstract build(): void

  /** Must release every GPU resource `build` allocated. */
  protected abstract teardown(): void
}
