/**
 * Design tokens for the utility-class parser.
 *
 * Everything here is expressed in *design pixels*, the same unit you'd use in
 * CSS. `PIXELS_PER_UNIT` converts them to world units at draw time.
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

/** Thickness of the extruded card, in design pixels. */
export const CARD_DEPTH_PX = 5

/** Chamfer on the card's front and back edges, in design pixels. */
export const CARD_BEVEL_PX = 0.25

/** Multiplier applied to font size to get a single line's box height. */
export const LINE_HEIGHT = 1.35

/**
 * A curated palette that mirrors Tailwind's naming so `bg-teal-500` means what
 * you expect. It is a subset, not a copy — extend it by adding rows. Anything
 * not listed here can still be written inline as `bg-[#ff0088]`.
 */
export const COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',

  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',

  'red-400': '#f87171',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',

  'orange-400': '#fb923c',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  'orange-700': '#c2410c',

  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'amber-700': '#b45309',

  'yellow-400': '#facc15',
  'yellow-500': '#eab308',
  'yellow-600': '#ca8a04',
  'yellow-700': '#a16207',

  'lime-400': '#a3e635',
  'lime-500': '#84cc16',
  'lime-600': '#65a30d',
  'lime-700': '#4d7c0f',

  'green-400': '#4ade80',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',

  'emerald-400': '#34d399',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  'emerald-700': '#047857',

  'teal-400': '#2dd4bf',
  'teal-500': '#14b8a6',
  'teal-600': '#0d9488',
  'teal-700': '#0f766e',

  'cyan-400': '#22d3ee',
  'cyan-500': '#06b6d4',
  'cyan-600': '#0891b2',
  'cyan-700': '#0e7490',

  'sky-400': '#38bdf8',
  'sky-500': '#0ea5e9',
  'sky-600': '#0284c7',
  'sky-700': '#0369a1',

  'blue-400': '#60a5fa',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',

  'indigo-400': '#818cf8',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  'indigo-700': '#4338ca',

  'violet-400': '#a78bfa',
  'violet-500': '#8b5cf6',
  'violet-600': '#7c3aed',
  'violet-700': '#6d28d9',

  'purple-400': '#c084fc',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'purple-700': '#7e22ce',

  'fuchsia-400': '#e879f9',
  'fuchsia-500': '#d946ef',
  'fuchsia-600': '#c026d3',
  'fuchsia-700': '#a21caf',

  'pink-400': '#f472b6',
  'pink-500': '#ec4899',
  'pink-600': '#db2777',
  'pink-700': '#be185d',

  'rose-400': '#fb7185',
  'rose-500': '#f43f5e',
  'rose-600': '#e11d48',
  'rose-700': '#be123c',
}

/** Tailwind's spacing scale, in design pixels. Drives every `p-*` token. */
export const SPACING: Record<string, number> = {
  '0': 0,
  px: 1,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
}

/** Corner radii. The empty key is bare `rounded`, matching Tailwind's default. */
export const RADIUS: Record<string, number> = {
  '': 4,
  none: 0,
  sm: 2,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
}

export const FONT_SIZE: Record<string, number> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
}

export const FONT_WEIGHT: Record<string, number> = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
}

/**
 * Resolves a colour token to a CSS colour string.
 *
 * Accepts palette names (`teal-500`, `white`) and Tailwind-style arbitrary
 * values (`[#ff0088]`, `[rgb(255_0_136)]`), where underscores stand in for
 * spaces. Returns undefined for anything it doesn't recognise, which is how
 * the parser tells colours apart from same-prefixed tokens like `text-lg`.
 */
export function resolveColor(name: string): string | undefined {
  const arbitrary = name.match(/^\[(.+)\]$/)
  if (arbitrary) return arbitrary[1].replace(/_/g, ' ')
  return COLORS[name]
}
