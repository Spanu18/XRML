import * as THREE from 'three'
import { getStage } from '../core/stage.ts'
import { isMeasuringHover } from '../style/hover.ts'
import { onThemeChange } from '../style/theme.ts'
import { DEPTH_REGISTRATION } from '../style/computed.ts'

let tagStyles: HTMLStyleElement | null = null

/**
 * The stylesheet that registers a spatial tag with the page.
 *
 * It is inserted as the document's *first* stylesheet, and that position is
 * load-bearing: cascade layers rank by where they are first declared, so
 * declaring `xrml` before Tailwind declares `utilities` is what puts our
 * defaults underneath everything a page author writes. Appending it instead
 * would rank `xrml` last and our defaults would beat `bg-teal-500`.
 */
function tagStyleSheet(): HTMLStyleElement {
  if (!tagStyles) {
    tagStyles = document.createElement('style')
    // Outside the layer: `@property` is a registration, not a declaration, and
    // has no cascade to lose.
    tagStyles.append(DEPTH_REGISTRATION)
    document.head.prepend(tagStyles)
  }
  return tagStyles
}

/**
 * Registers a spatial tag: hidden from 2D layout, with a style to fall back on.
 *
 * Spatial elements stay in the real DOM — they're the config, the event target,
 * and what a screen reader or a querySelector sees — but the scene owns all
 * actual rendering. `display` is declared outside the layer so that a component
 * class the element also carries (daisyUI's `.btn` sets `display: inline-flex`)
 * can't drag the source markup back into the page.
 */
function registerTag(tag: string, defaults: string): void {
  tagStyleSheet().append(
    `${tag}{display:none}`,
    `@layer xrml{${tag}{${defaults}}}`,
  )
}

export function defineElement(
  tag: string,
  constructor: CustomElementConstructor,
  defaults = '',
): void {
  if (customElements.get(tag)) return
  registerTag(tag, defaults)
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
  private unwatchTheme: (() => void) | null = null
  private rebuildQueued = false
  private built = false

  connectedCallback(): void {
    getStage().scene.add(this.object)
    this.applyTransform()
    this.build()
    this.built = true

    // A theme swap changes what this element resolves to without touching it.
    this.unwatchTheme = onThemeChange(() => this.invalidate())

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

    this.unwatchTheme?.()
    this.unwatchTheme = null

    if (this.built) {
      this.teardown()
      this.built = false
    }
    this.object.removeFromParent()
  }

  attributeChangedCallback(name: string): void {
    // Fires during upgrade too, before there's anything to update.
    if (!this.built) return
    if (name !== 'class') {
      this.applyTransform()
      return
    }
    // Measuring the hover style toggles a class on this element. Rebuilding on
    // that would restart the measurement that caused it.
    if (isMeasuringHover()) return
    this.invalidate()
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
