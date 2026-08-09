/**
 * Noticing that the document's theme changed.
 *
 * Spatial elements rebuild when their own attributes or text change, which is
 * enough for anything addressed *at* them — but a theme swap is addressed at
 * the document. daisyUI's theme controller is the sharp case: it is pure CSS,
 * `:root:has(input.theme-controller[value=aqua]:checked)`, so checking a radio
 * on the far side of the page silently redefines every colour variable without
 * mutating a single attribute an element could observe.
 *
 * There is no event for "your computed style changed", so this watches the
 * things that can cause it and compares a fingerprint of the custom properties
 * on `:root`. Listening beats polling: a theme changes on interaction, not on a
 * timer, and a spatial page is already spending its frame budget on rendering.
 */

type Listener = () => void

const listeners = new Set<Listener>()
let fingerprint: string | null = null
let started = false

/**
 * The resolved value of every custom property on `:root`.
 *
 * Themes are variables, so this catches any of them changing without needing to
 * know which ones a given theme cares about — daisyUI's `--color-base-100` and
 * a hand-rolled `--brand` are the same thing here.
 */
function readFingerprint(): string {
  const style = window.getComputedStyle(document.documentElement)
  const parts: string[] = []

  for (let index = 0; index < style.length; index += 1) {
    const name = style.item(index)
    if (name.startsWith('--')) {
      parts.push(`${name}:${style.getPropertyValue(name)}`)
    }
  }

  return parts.join(';')
}

function check(): void {
  const next = readFingerprint()
  if (next === fingerprint) return
  fingerprint = next
  for (const listener of listeners) listener()
}

function start(): void {
  if (started) return
  started = true
  fingerprint = readFingerprint()

  // A theme is switched by a control being toggled, an attribute being set, or
  // a stylesheet being swapped. Capture, so it still counts if a handler
  // downstream stops propagation.
  document.addEventListener('change', check, true)
  document.addEventListener('click', check, true)

  new MutationObserver(check).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme'],
  })

  new MutationObserver(check).observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

/** Calls `listener` whenever the document's custom properties change. */
export function onThemeChange(listener: Listener): () => void {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}
