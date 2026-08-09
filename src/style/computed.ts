import { formatHex, parse } from 'culori'
import { whileHovered } from './hover.ts'
import { CARD_DEPTH_PX } from './units.ts'

/**
 * Reading a spatial element's style off the browser.
 *
 * The element is a real element in a real document, so the browser has already
 * resolved its style — the cascade, custom properties, `calc()`, `color-mix()`,
 * media queries, cascade layers and every stylesheet on the page. Reading that
 * back is strictly more capable than parsing the `class` attribute ourselves,
 * and it is the only approach that works for classes we don't author: a
 * component class like daisyUI's `.btn` carries no size or colour in its name,
 * only in the rule it expands to.
 *
 * Values arrive in *design pixels*, the unit CSS itself uses;
 * `PIXELS_PER_UNIT` converts them to world units at draw time.
 *
 * Being `display: none` is what makes this cheap and exact. A non-rendered
 * element still resolves every property we ask for, but it runs no transitions,
 * so a hover colour reads as its settled target immediately rather than as
 * whatever frame an animation happens to be on.
 */

/**
 * How thick the card is, in design pixels.
 *
 * The one property with no CSS equivalent to read, because a stylesheet has no
 * depth axis — so xrml adds one rather than inferring it from something that
 * doesn't mean thickness. Keeping it a custom property means it still arrives
 * through the cascade like everything else: set it on a container and a whole
 * panel inherits it, or set it on one element for one card.
 */
export const DEPTH_PROPERTY = '--xr-depth'

/**
 * `@property` registration for the depth.
 *
 * Without it a custom property is substituted verbatim rather than computed —
 * `--xr-depth: 1rem` would arrive as the literal string `1rem`, and resolving
 * units by hand is exactly the job this module exists to stop doing. Registering
 * a `<length>` makes the browser compute it to pixels, and carries the default.
 */
export const DEPTH_REGISTRATION =
  `@property ${DEPTH_PROPERTY}{` +
  `syntax:"<length>";inherits:true;initial-value:${CARD_DEPTH_PX}px}`

/** A colour plus its alpha, kept apart because the card blends on opacity. */
export type Paint = {
  color: string
  opacity: number
}

/** A fully resolved visual style. Every value is concrete — no inheritance. */
export type Style = {
  background: Paint
  color: string
  fontSize: number
  fontWeight: number
  /** Corner radius in design pixels, or a fraction of the box if authored in %. */
  radius: number
  radiusFraction: number | null
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  /** Explicit sizes, or null where CSS said `auto` and the content decides. */
  width: number | null
  height: number | null
  minWidth: number
  minHeight: number
  depth: number
}

/** The `:hover` variant is a full style, resolved the way the browser would. */
export type StyleSet = {
  base: Style
  hover: Style
}

/** Computed lengths are always absolute, so a bare `parseFloat` is enough. */
function pixels(value: string): number {
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) ? amount : 0
}

/**
 * Reads a length that CSS is allowed to leave up to layout.
 *
 * `auto` and percentages both come back null: there is no containing block to
 * resolve them against, so the content has to decide the size instead.
 */
function optionalPixels(value: string): number | null {
  if (!value.endsWith('px')) return null
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) ? amount : null
}

/**
 * Splits a computed colour into a hex string and an alpha.
 *
 * Computed colours are not the strings that were authored: a theme written in
 * `oklch()` and mixed with `color-mix()` arrives as `oklab(...)`, which three.js
 * can't read. culori normalises all of it to sRGB.
 */
function paint(value: string): Paint {
  const parsed = parse(value)
  if (!parsed) return { color: '#000000', opacity: 0 }
  return { color: formatHex(parsed) ?? '#000000', opacity: parsed.alpha ?? 1 }
}

/**
 * Reads a corner radius.
 *
 * `rounded-full` computes to `calc(infinity * 1px)`, which arrives as a number
 * far larger than any card; the geometry clamps it to half the shorter side, so
 * it needs no special case. A percentage does, because it is relative to a box
 * that hasn't been measured yet.
 */
function radius(value: string): Pick<Style, 'radius' | 'radiusFraction'> {
  // Elliptical radii are two lengths; the card is circular, so take the first.
  const first = value.trim().split(/\s+/)[0] ?? '0px'
  if (first.endsWith('%')) {
    return { radius: 0, radiusFraction: Number.parseFloat(first) / 100 }
  }
  return { radius: pixels(first), radiusFraction: null }
}

function read(element: Element): Style {
  const style = window.getComputedStyle(element)

  return {
    background: paint(style.backgroundColor),
    color: paint(style.color).color,
    fontSize: pixels(style.fontSize),
    fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
    ...radius(style.borderTopLeftRadius),
    paddingTop: pixels(style.paddingTop),
    paddingRight: pixels(style.paddingRight),
    paddingBottom: pixels(style.paddingBottom),
    paddingLeft: pixels(style.paddingLeft),
    width: optionalPixels(style.width),
    height: optionalPixels(style.height),
    minWidth: optionalPixels(style.minWidth) ?? 0,
    minHeight: optionalPixels(style.minHeight) ?? 0,
    depth: Math.max(pixels(style.getPropertyValue(DEPTH_PROPERTY)), 0),
  }
}

/** Resolves an element's style and the style it would take while hovered. */
export function readStyleSet(element: Element): StyleSet {
  return {
    base: read(element),
    hover: whileHovered(element, () => read(element)),
  }
}
