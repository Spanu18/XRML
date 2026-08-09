/**
 * `:hover` emulation for elements the browser will never hover.
 *
 * A spatial element's pointer is a raycast, not a mouse, so no `:hover` rule
 * will ever match it however the page is styled. Rather than re-implement the
 * cascade to work out what hovering *would* have done, we mirror it: every
 * `:hover` rule in the document is copied once, with `:hover` rewritten to
 * `.xrml-hover` and the surrounding at-rules rebuilt around it. Adding that
 * class then produces exactly the style a real hover would.
 *
 * The mirror wins the tie by document order — `:hover` and a class have the
 * same specificity, and each copy is re-declared into the same cascade layer as
 * its original, so it lands after it. That is what makes both Tailwind's
 * `hover:bg-teal-400` and daisyUI's `.btn:hover` resolve without either being
 * special-cased.
 */

/** Stand-in for `:hover`, added to an element only while it is being measured. */
export const HOVER_CLASS = 'xrml-hover'

let sheet: HTMLStyleElement | null = null
let stale = true
let measuring = false

/**
 * Whether a hover measurement is in flight.
 *
 * Toggling the class mutates `class`, which elements observe to rebuild
 * themselves — so they have to know to sit still while we read them.
 */
export function isMeasuringHover(): boolean {
  return measuring
}

/**
 * Rebuilds the opening text of a grouping rule without serialising its body.
 *
 * `cssText` would work for all of these, but on a rule like Tailwind's
 * `@layer utilities` it serialises every rule inside it just to read the first
 * line, so the common cases are reconstructed from their own fields instead.
 */
function prelude(rule: CSSGroupingRule): string {
  if (rule instanceof CSSMediaRule) return `@media ${rule.conditionText}{`
  if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText}{`
  if (rule instanceof CSSLayerBlockRule) return `@layer ${rule.name}{`

  const text = rule.cssText
  return text.slice(0, text.indexOf('{') + 1)
}

function collect(
  rules: CSSRuleList,
  open: string,
  close: string,
  out: string[],
): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSImportRule) {
      // An imported sheet cascades in place, so its rules are walked here.
      try {
        if (rule.styleSheet) collect(rule.styleSheet.cssRules, open, close, out)
      } catch {
        // Cross-origin import; unreadable by design.
      }
      continue
    }

    if (rule instanceof CSSStyleRule) {
      if (rule.selectorText.includes(':hover')) {
        const selector = rule.selectorText.replaceAll(':hover', `.${HOVER_CLASS}`)
        out.push(`${open}${selector}{${rule.style.cssText}}${close}`)
      }
      // Nested rules: `&:hover` inside `.btn` is how daisyUI writes its states.
      if (rule.cssRules.length > 0) {
        collect(rule.cssRules, `${open}${rule.selectorText}{`, `}${close}`, out)
      }
      continue
    }

    if (rule instanceof CSSGroupingRule) {
      collect(rule.cssRules, `${open}${prelude(rule)}`, `}${close}`, out)
    }
  }
}

function rebuild(): void {
  const out: string[] = []

  for (const styleSheet of Array.from(document.styleSheets)) {
    if (styleSheet.ownerNode === sheet) continue
    try {
      collect(styleSheet.cssRules, '', '', out)
    } catch {
      // Cross-origin stylesheet; its rules can't be read.
    }
  }

  if (!sheet) {
    sheet = document.createElement('style')
    document.head.appendChild(sheet)

    // Vite swaps stylesheet contents in place on hot update, and a page can add
    // styles at any time, so the mirror is invalidated rather than built once.
    new MutationObserver((records) => {
      if (records.every((record) => record.target === sheet)) return
      stale = true
    }).observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  sheet.textContent = out.join('\n')
  stale = false
}

/**
 * Reads a value off `element` as though it were hovered.
 *
 * The class is added and removed synchronously around `read`, so it is never
 * observable to anything but a style lookup.
 */
export function whileHovered<T>(element: Element, read: () => T): T {
  if (stale) rebuild()

  measuring = true
  element.classList.add(HOVER_CLASS)
  try {
    return read()
  } finally {
    element.classList.remove(HOVER_CLASS)
    measuring = false
  }
}
