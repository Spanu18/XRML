import * as THREE from 'three'
import { Text } from 'troika-three-text'
import { XRElement, defineElement } from './base.ts'
import {
  registerInteractive,
  unregisterInteractive,
} from '../core/interaction.ts'
import { parseClasses } from '../style/parse.ts'
import type { Style, StyleSet } from '../style/parse.ts'
import { createCardGeometry, createCardMaterial } from '../style/card.ts'
import type { CardMaterial } from '../style/card.ts'
import { fontFor } from '../style/fonts.ts'
import {
  CARD_BEVEL_PX,
  CARD_DEPTH_PX,
  LINE_HEIGHT,
  PIXELS_PER_UNIT,
} from '../style/tokens.ts'

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

function backgroundColor(style: Style): THREE.Color {
  return new THREE.Color(
    style.background === 'transparent' ? '#000000' : style.background,
  )
}

function backgroundOpacity(style: Style): number {
  return style.background === 'transparent' ? 0 : 1
}

/**
 * `<xr-button>` — a spatial button styled with utility classes.
 *
 * ```html
 * <xr-button class="bg-teal-500 hover:bg-teal-400 text-white p-4 rounded-lg"
 *            position="0 1.6 -1.5"
 *            onclick="doSomething()">Click me</xr-button>
 * ```
 *
 * The body is one extruded rounded rectangle and the label is SDF text, so both
 * stay sharp at any viewing distance. `hover:` variants change colour only — a
 * hover that resized the card would make the button jump under the pointer.
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
    const styles = parseClasses(this.getAttribute('class') ?? '')
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
    const textWidth = bounds ? bounds[2] - bounds[0] : 0

    const padTop = base.paddingTop / PIXELS_PER_UNIT
    const padRight = base.paddingRight / PIXELS_PER_UNIT
    const padBottom = base.paddingBottom / PIXELS_PER_UNIT
    const padLeft = base.paddingLeft / PIXELS_PER_UNIT

    const width = Math.max(textWidth + padLeft + padRight, MIN_SIZE)
    const height = Math.max(
      (base.fontSize / PIXELS_PER_UNIT) * LINE_HEIGHT + padTop + padBottom,
      MIN_SIZE,
    )

    // Asymmetric padding shifts the label off centre, as it would in CSS.
    text.position.x = (padLeft - padRight) / 2
    text.position.y = (padBottom - padTop) / 2

    this.cardColors = {
      base: backgroundColor(base),
      hover: backgroundColor(styles.hover),
    }
    this.cardOpacity = {
      base: backgroundOpacity(base),
      hover: backgroundOpacity(styles.hover),
    }

    const blended = this.cardOpacity.base < 1 || this.cardOpacity.hover < 1

    const card: CardMesh = new THREE.Mesh(
      createCardGeometry(
        width,
        height,
        base.radius / PIXELS_PER_UNIT,
        CARD_DEPTH_PX / PIXELS_PER_UNIT,
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

defineElement('xr-button', XRButtonElement)

declare global {
  interface HTMLElementTagNameMap {
    'xr-button': XRButtonElement
  }
}
