/**
 * Minimal declarations for troika-three-text, which ships no types of its own.
 * Covers only the surface xrml uses — extend as needed.
 */
declare module 'troika-three-text' {
  import type { Mesh } from 'three'

  export type TextRenderInfo = {
    /** [minX, minY, maxX, maxY] of the laid-out block, in local units. */
    blockBounds: [number, number, number, number]
    /** [minX, minY, maxX, maxY] of the inked glyphs only. */
    visibleBounds: [number, number, number, number]
  }

  export class Text extends Mesh {
    text: string
    /** URL of a .ttf/.otf/.woff. Set it to avoid troika's CDN font lookup. */
    font: string | null
    fontSize: number
    fontWeight: number | 'normal' | 'bold'
    lineHeight: number | 'normal'
    letterSpacing: number
    color: string | number | null
    fillOpacity: number
    anchorX: number | 'left' | 'center' | 'right'
    anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom'
    textAlign: 'left' | 'right' | 'center' | 'justify'
    maxWidth: number
    /** SDF texels per glyph. Higher survives closer inspection. */
    sdfGlyphSize: number
    /** Polygon-offset nudge, for text sitting on a coplanar background. */
    depthOffset: number
    readonly textRenderInfo: TextRenderInfo | null
    sync(callback?: () => void): void
    dispose(): void
  }

  export function preloadFont(
    options: {
      font?: string
      characters?: string | string[]
      sdfGlyphSize?: number
    },
    callback: () => void,
  ): void
}
