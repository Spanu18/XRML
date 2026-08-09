import weight300 from '@fontsource/inter/files/inter-latin-300-normal.woff?url'
import weight400 from '@fontsource/inter/files/inter-latin-400-normal.woff?url'
import weight500 from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import weight600 from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import weight700 from '@fontsource/inter/files/inter-latin-700-normal.woff?url'
import weight800 from '@fontsource/inter/files/inter-latin-800-normal.woff?url'

/**
 * Bundled font files, one per weight.
 *
 * SDF text needs real glyph outlines, so it needs a font file — there's no way
 * to read outlines for a system font from the browser. These ship with the
 * package rather than being fetched: troika will otherwise resolve fonts
 * through a jsDelivr CDN at runtime, which would make rendering depend on the
 * network and on a third party staying up.
 *
 * Inter is used under the SIL Open Font License. WOFF (not WOFF2) because
 * troika's parser inflates WOFF but can't read WOFF2's Brotli compression.
 */
const FONT_FILES: Record<number, string> = {
  300: weight300,
  400: weight400,
  500: weight500,
  600: weight600,
  700: weight700,
  800: weight800,
}

const AVAILABLE = Object.keys(FONT_FILES)
  .map(Number)
  .sort((a, b) => a - b)

/** Resolves a CSS font weight to the nearest bundled file. */
export function fontFor(weight: number): string {
  let closest = AVAILABLE[0]
  for (const candidate of AVAILABLE) {
    if (Math.abs(candidate - weight) < Math.abs(closest - weight)) {
      closest = candidate
    }
  }
  return FONT_FILES[closest]
}
