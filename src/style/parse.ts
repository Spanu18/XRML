import {
  FONT_SIZE,
  FONT_WEIGHT,
  RADIUS,
  SPACING,
  resolveColor,
} from './tokens.ts'

/** A fully resolved visual style. Every value is concrete — no inheritance. */
export type Style = {
  background: string
  color: string
  fontSize: number
  fontWeight: number
  radius: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
}

/** The `:hover` variant is a full style, resolved on top of the base. */
export type StyleSet = {
  base: Style
  hover: Style
}

const DEFAULTS: Style = {
  background: '#334155',
  color: '#ffffff',
  fontSize: FONT_SIZE.base,
  fontWeight: FONT_WEIGHT.medium,
  radius: RADIUS[''],
  paddingTop: SPACING['3'],
  paddingRight: SPACING['5'],
  paddingBottom: SPACING['3'],
  paddingLeft: SPACING['5'],
}

const PADDING_SIDES: Record<string, Array<keyof Style>> = {
  p: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  px: ['paddingLeft', 'paddingRight'],
  py: ['paddingTop', 'paddingBottom'],
  pt: ['paddingTop'],
  pr: ['paddingRight'],
  pb: ['paddingBottom'],
  pl: ['paddingLeft'],
}

/**
 * Applies one utility token to a style, in place.
 *
 * Unrecognised tokens are ignored rather than reported. That is deliberate:
 * the `class` attribute is shared with real CSS, so an element may legitimately
 * carry classes this parser knows nothing about.
 */
function applyToken(style: Style, token: string): void {
  const dash = token.indexOf('-')
  const prefix = dash === -1 ? token : token.slice(0, dash)
  const value = dash === -1 ? '' : token.slice(dash + 1)

  if (prefix === 'bg') {
    const color = resolveColor(value)
    if (color !== undefined) style.background = color
    return
  }

  if (prefix === 'text') {
    // `text-*` is overloaded in Tailwind: size wins if the value names one,
    // otherwise we try to read it as a colour.
    const size = FONT_SIZE[value]
    if (size !== undefined) {
      style.fontSize = size
      return
    }
    const color = resolveColor(value)
    if (color !== undefined) style.color = color
    return
  }

  if (prefix === 'font') {
    const weight = FONT_WEIGHT[value]
    if (weight !== undefined) style.fontWeight = weight
    return
  }

  if (prefix === 'rounded') {
    const radius = RADIUS[value]
    if (radius !== undefined) style.radius = radius
    return
  }

  const sides = PADDING_SIDES[prefix]
  if (sides) {
    const space = SPACING[value]
    if (space !== undefined) {
      for (const side of sides) {
        // Every padding key is a number; the cast narrows the union for TS.
        ;(style[side] as number) = space
      }
    }
  }
}

/**
 * Parses a `class` attribute into a base style and its hover variant.
 *
 * Unprefixed tokens land in both styles; `hover:`-prefixed tokens override the
 * hover style only. That ordering is what makes `bg-teal-500 hover:bg-teal-400`
 * behave the way the CSS equivalent would.
 */
export function parseClasses(classAttribute: string): StyleSet {
  const tokens = classAttribute.split(/\s+/).filter(Boolean)

  const base: Style = { ...DEFAULTS }
  const hoverTokens: string[] = []

  for (const token of tokens) {
    const colon = token.indexOf(':')
    if (colon === -1) {
      applyToken(base, token)
    } else if (token.slice(0, colon) === 'hover') {
      hoverTokens.push(token.slice(colon + 1))
    }
  }

  const hover: Style = { ...base }
  for (const token of hoverTokens) applyToken(hover, token)

  return { base, hover }
}
