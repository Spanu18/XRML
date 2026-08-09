import * as THREE from 'three'
import { Text } from 'troika-three-text'
import { XRElement, defineElement } from './base.ts'
import {
  registerInteractive,
  unregisterInteractive,
} from '../core/interaction.ts'
import { readStyleSet } from '../style/computed.ts'
import type { Style, StyleSet } from '../style/computed.ts'
import { createCardGeometry, createCardMaterial } from '../style/card.ts'
import type { CardMaterial } from '../style/card.ts'
import { fontFor } from '../style/fonts.ts'
import { CARD_BEVEL_PX, LINE_HEIGHT, PIXELS_PER_UNIT } from '../style/units.ts'

/** How dark the card's sides fall relative to its face. */
const EDGE_SHADE = 0.55

/** SDF texels per glyph. 64 is troika's default and holds up under close zoom. */
const SDF_GLYPH_SIZE = 64

/** Smallest card we'll produce, so an empty element still has a hit target. */
const MIN_SIZE = 8 / PIXELS_PER_UNIT

/**
 * The label sits exactly on the card's front face — no physical gap — and wins
 * the depth test through a polygon offset instead. Lifting it even a fraction
 * of a millimetre makes it visibly detach when you view the button edge-on.
 */
const TEXT_DEPTH_OFFSET = -1

type CardMesh = THREE.Mesh<THREE.ExtrudeGeometry, CardMaterial>
type StateColors = { base: THREE.Color; hover: THREE.Color }

/**
 * Default styling, in the lowest cascade layer — any page CSS overrides it.
 * Written as CSS rather than as a JS fallback so it takes part in the cascade
 * like everything else: `class="bg-teal-500"` beats it for the same reason it
 * would beat any other author rule.
 */
const DEFAULTS = `
  background-color: #334155;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 500;
  padding: 0.75rem 1.25rem;
  border-radius: 0.25rem;
`

/**
 * The card's corner radius in world units.
 *
 * A percentage radius is relative to the box, which only exists once the label
 * has been measured — and it describes an ellipse, which the card can't be, so
 * it resolves against the shorter side. That reads as the intended pill for the
 * `50%` case and stays inside the corner for everything below it.
 */
function cornerRadius(style: Style, width: number, height: number): number {
  if (style.radiusFraction !== null) {
    return style.radiusFraction * Math.min(width, height)
  }
  return style.radius / PIXELS_PER_UNIT
}

/**
 * `<xr-button>` — a spatial button styled with ordinary CSS.
 *
 * ```html
 * <xr-button class="bg-teal-500 hover:bg-teal-400 text-white p-4 rounded-lg"
 *            position="0 1.6 -1.5"
 *            onclick="doSomething()">Click me</xr-button>
 * ```
 *
 * Style comes from the browser's computed style, not from reading the class
 * names, so utility classes, component classes like daisyUI's `.btn`, a plain
 * stylesheet and an inline `style` attribute all work and compose the way they
 * do everywhere else on the page.
 *
 * The body is one extruded rounded rectangle and the label is SDF text, so both
 * stay sharp at any viewing distance. Hover changes colour only — a hover that
 * resized the card would make the button jump under the pointer.
 */
export class XRButtonElement extends XRElement {
  private text: Text | null = null
  private card: CardMesh | null = null
  private styles: StyleSet | null = null
  private cardColors: StateColors | null = null
  private cardOpacity: { base: number; hover: number } | null = null

  /** Bumped on build and teardown so a late `sync` from a stale build is dropped. */
  private generation = 0

  protected build(): void {
    const styles = readStyleSet(this)
    this.styles = styles

    const generation = (this.generation += 1)

    const text = new Text()
    text.text = this.label
    text.font = fontFor(styles.base.fontWeight)
    text.fontSize = styles.base.fontSize / PIXELS_PER_UNIT
    text.lineHeight = LINE_HEIGHT
    text.color = styles.base.color
    text.anchorX = 'center'
    text.anchorY = 'middle'
    text.sdfGlyphSize = SDF_GLYPH_SIZE
    text.renderOrder = 1
    text.depthOffset = TEXT_DEPTH_OFFSET

    this.text = text
    this.object.add(text)

    // troika parses the font and lays out glyphs off the main thread, so the
    // card can't be sized until that lands.
    text.sync(() => {
      if (generation !== this.generation) return
      this.layout(styles, text)
    })
  }

  private layout(styles: StyleSet, text: Text): void {
    const base = styles.base
    const bounds = text.textRenderInfo?.blockBounds
    const textWidthPx = (bounds ? bounds[2] - bounds[0] : 0) * PIXELS_PER_UNIT

    // Everything below is in design pixels, so CSS lengths need no conversion
    // and the box arithmetic reads the way the equivalent CSS would.
    const contentWidth = textWidthPx + base.paddingLeft + base.paddingRight
    const contentHeight =
      base.fontSize * LINE_HEIGHT + base.paddingTop + base.paddingBottom

    // An explicit size wins over the content, and includes the padding: pages
    // that reach us have `box-sizing: border-box`, and a component class like
    // `.btn` sizes itself by height with no vertical padding at all.
    const widthPx = Math.max(base.width ?? contentWidth, base.minWidth)
    const heightPx = Math.max(base.height ?? contentHeight, base.minHeight)

    const width = Math.max(widthPx / PIXELS_PER_UNIT, MIN_SIZE)
    const height = Math.max(heightPx / PIXELS_PER_UNIT, MIN_SIZE)

    // Asymmetric padding shifts the label off centre, as it would in CSS.
    text.position.x =
      (base.paddingLeft - base.paddingRight) / 2 / PIXELS_PER_UNIT
    text.position.y =
      (base.paddingBottom - base.paddingTop) / 2 / PIXELS_PER_UNIT

    this.cardColors = {
      base: new THREE.Color(base.background.color),
      hover: new THREE.Color(styles.hover.background.color),
    }
    this.cardOpacity = {
      base: base.background.opacity,
      hover: styles.hover.background.opacity,
    }

    const blended = this.cardOpacity.base < 1 || this.cardOpacity.hover < 1

    const card: CardMesh = new THREE.Mesh(
      createCardGeometry(
        width,
        height,
        cornerRadius(base, width, height),
        base.depth / PIXELS_PER_UNIT,
        CARD_BEVEL_PX / PIXELS_PER_UNIT,
      ),
      createCardMaterial(
        this.cardColors.base.clone(),
        this.cardOpacity.base,
        EDGE_SHADE,
        blended,
      ),
    )
    this.object.add(card)
    this.card = card

    registerInteractive({
      object: card,
      source: this,
      setHovered: (isHovered) => this.setHovered(isHovered),
    })
  }

  private setHovered(isHovered: boolean): void {
    if (!this.styles) return

    const key = isHovered ? 'hover' : 'base'

    if (this.card && this.cardColors && this.cardOpacity) {
      this.card.material.uniforms.uColor.value.copy(this.cardColors[key])
      this.card.material.uniforms.uOpacity.value = this.cardOpacity[key]
    }

    if (this.text) {
      this.text.color = this.styles[key].color
    }
  }

  protected teardown(): void {
    // Invalidate any sync callback still in flight from the build being replaced.
    this.generation += 1

    if (this.card) {
      unregisterInteractive(this.card)
      this.card.geometry.dispose()
      this.card.material.dispose()
      this.card = null
    }

    if (this.text) {
      this.text.dispose()
      this.text = null
    }

    this.styles = null
    this.cardColors = null
    this.cardOpacity = null
    this.object.clear()
  }
}

defineElement('xr-button', XRButtonElement, DEFAULTS)

declare global {
  interface HTMLElementTagNameMap {
    'xr-button': XRButtonElement
  }
}
