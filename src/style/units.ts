/**
 * The bridge between CSS lengths and the scene.
 *
 * Styles are read off the browser in *design pixels* — the unit CSS itself
 * resolves to — and everything here converts that scale into world units or
 * describes geometry measured in it.
 */

/**
 * Design pixels per world unit (world units are metres in WebXR).
 *
 * Chosen for legibility, not for a tidy conversion: at 500, `text-base` is 32mm
 * tall, which subtends ~1.2° at a 1.5m viewing distance. Comfortable reading in
 * a headset wants roughly 1–2°, and text much below that turns to mush however
 * good the texture is.
 */
export const PIXELS_PER_UNIT = 500

/**
 * Default thickness of the extruded card, in design pixels.
 *
 * Only the default: thickness is authored as the `--xr-depth` custom property,
 * and this is the `initial-value` that registration carries.
 */
export const CARD_DEPTH_PX = 5

/**
 * Smallest edge a card's front and back get, in design pixels.
 *
 * A square-cornered card keeps exactly this, so its edges still catch light
 * rather than reading as a cut. Rounder cards roll further on their own, up to
 * half the depth — see `edgeRoll`.
 */
export const CARD_BEVEL_PX = 0.25

/** Multiplier applied to font size to get a single line's box height. */
export const LINE_HEIGHT = 1.35
