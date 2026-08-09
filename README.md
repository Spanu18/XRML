# xrml

Spatial UI as native web components. Ordinary CSS in, 3D buttons out — no WebGL
knowledge needed to use it, no framework required to install it.

```html
<xr-button
  class="bg-teal-500 hover:bg-teal-400 text-white p-4 rounded-lg text-lg"
  position="0 1.6 -1.5"
  onclick="doSomething()"
>Click me</xr-button>
```

That's the whole API surface for a button. The style comes from the browser's
own computed style, so this works identically:

```html
<xr-button class="btn btn-primary">daisyUI</xr-button>
<xr-button style="background: #7c3aed; padding: 1rem">inline</xr-button>
<xr-button class="my-own-class">a plain stylesheet</xr-button>
```

`onclick` is a real inline handler, triggered by a real `MouseEvent`.

## Status

**v0 foundation.** One element (`<xr-button>`), the style pipeline behind it, and
the scene and interaction plumbing they sit on. Not published, not versioned, no
framework wrappers, **no test suite** — behaviour has been checked with ad-hoc
headless Chromium runs, not by anything that would catch a regression.

## Run

```bash
yarn install
yarn dev
```

Drag to orbit, hover and click the buttons.

### On a headset

```bash
yarn dev:xr    # HTTPS, exposed on the LAN
```

Then browse to the printed `https://192.168.x.x:5173` address from the headset
and accept the self-signed certificate warning. **Enter AR/VR** starts an
immersive session and the controller rays become the pointer.

The HTTPS part is not optional. WebXR is `[SecureContext]`, so on a plain
`http://192.168.x.x` origin `navigator.xr` is `undefined` and even a Quest
reports no WebXR at all. `localhost` is exempt — it counts as secure — which is
why plain `yarn dev` is fine on the machine itself.

If no session is available the launcher says which of three things went wrong:

| Button | Meaning |
| --- | --- |
| **Needs HTTPS** | Insecure origin — `navigator.xr` is hidden. Use `yarn dev:xr`. |
| **No WebXR here** | The browser has no WebXR at all (any macOS browser, iPhone Safari). |
| **No headset detected** | WebXR exists, but no immersive device is connected. |

Nothing prompts for permission during this check: `isSessionSupported()` is
specified never to prompt. Any consent request happens at `requestSession()`,
which needs a user gesture — so it can only appear after you press the button.

## Styling

**xrml does not parse your class names.** A spatial element is a real element in
a real document, so the browser has already resolved its style — the cascade,
custom properties, `calc()`, `color-mix()`, media queries, cascade layers, every
stylesheet on the page. xrml reads that back with `getComputedStyle`.

That is why there is no list of supported utilities. Tailwind, daisyUI, `@apply`,
a hand-written stylesheet, an inline `style` attribute and your own custom
properties all work, and compose exactly the way they do everywhere else on the
page. A component class carries no size or colour in its *name* — daisyUI's
`.btn` is `--btn-bg`, `var(--size)` and `color-mix()` — and no amount of class
parsing would ever have reached it.

Elements are `display: none`, which is load-bearing: a non-rendered element still
resolves every property, but it runs no transitions, so a hover colour reads as
its settled target instead of whatever frame an animation happens to be on.

### What gets read

| Property | Becomes |
| --- | --- |
| `background-color` | Card colour and, via its alpha, its opacity |
| `color` | Label colour |
| `font-size` | Label size |
| `font-weight` | Nearest bundled Inter weight |
| `border-top-left-radius` | Corner radius (`%` resolves against the shorter side) |
| `padding-*` | Space around the label |
| `width` / `height` | Explicit size, overriding the content |
| `min-width` / `min-height` | Floor on that size |
| `--xr-depth` | Card thickness |

Shorthands need no special handling — computed style hands back longhands, so
`padding-inline` and `padding` arrive already split into four sides.

Explicit `width`/`height` include the padding, matching `box-sizing: border-box`.
This is what makes a component class work: daisyUI's `.btn` sizes itself with
`height: 40px` and *zero* vertical padding, which a content-box-only layout can't
express. `auto` and percentage sizes come back as "unset" and the content decides
— there is no containing block to resolve them against.

### What isn't read

Borders, `box-shadow`, gradients and `background-image`, element `opacity`, and
`transform`. `font-family` is ignored: SDF text needs real glyph outlines, so
only the bundled Inter is available and the weight is matched to it.

### Defaults and the cascade

`<xr-button>`'s built-in look is CSS, not a JS fallback, declared in a cascade
layer named `xrml`:

```css
@layer xrml {
  xr-button { background-color: #334155; padding: 0.75rem 1.25rem; /* … */ }
}
```

xrml inserts that as the document's *first* stylesheet, and the position is
deliberate: layers rank by where they are first declared, so declaring `xrml`
before Tailwind declares `utilities` is what puts the defaults underneath
anything you write. Appending instead would rank `xrml` last and the defaults
would beat `bg-teal-500`.

One consequence: a reset that resets *everything* outranks them too. On a
Tailwind page, preflight's `*{padding:0}` sits in `@layer base`, above `xrml`, so
an unstyled `<xr-button>` has no padding — exactly what happens to a real
`<button>` on the same page.

`display: none` is declared *outside* the layer, so a component class that sets
`display: inline-flex` (daisyUI's `.btn` does) can't drag the source markup back
into the page.

### Hover

A raycast is not a DOM hover, so no `:hover` rule will ever match a spatial
element. Rather than re-implement the cascade, xrml mirrors it: every `:hover`
rule in the document is copied once with `:hover` rewritten to `.xrml-hover`, and
re-declared into the same cascade layer so the copy wins the tie on order.
Reading a hover style is then add-class, read, remove-class.

Both `hover:bg-teal-400` and `.btn:hover` land through the same mechanism, with
nothing special-cased for either.

**Hover changes colour only.** The full hover style is resolved, but only the
background colour, its alpha, and the label colour are applied — resizing a card
under the pointer would shift it out from under you and oscillate.

### Depth

Thickness is the one property with no CSS equivalent to read, because a
stylesheet has no depth axis. xrml adds one as a custom property rather than
inferring it from something that doesn't mean thickness:

```css
xr-button.chunky { --xr-depth: 15px }
#panel          { --xr-depth: 2rem }   /* inherits to every card inside */
```

It is registered with `@property` as a `<length>`, so the browser computes it —
`1rem`, `calc(2 * 6px)` and inheritance all resolve before xrml sees it, and the
registration carries the `5px` default. An unregistered custom property would
arrive as a verbatim string and put unit maths back in JS, which is the job this
pipeline exists to avoid.

Corner radius also drives the depth axis. The roll tracks how round the
silhouette is *relative to its own maximum*, not an absolute pixel amount — the
card is only 5 design px deep, so comparing radii in pixels would saturate at
`rounded-sm` and every button would look the same. `rounded-none` keeps a bare
chamfer; `rounded-full` rolls the full half-depth into a capsule.

### Themes

Theme swaps are addressed at the document, not at the element, so there is
nothing on the element to observe — daisyUI's theme controller is pure CSS
(`:root:has(input.theme-controller[value=aqua]:checked)`) and mutates no
attribute at all. xrml watches the causes instead — `change`/`click` in the
capture phase, `data-theme`/`class`/`style` on `<html>`, and `<head>` mutations —
and compares a fingerprint of every custom property on `:root`.

daisyUI only emits `light` and `dark` unless told otherwise, so a theme has to be
named before `data-theme` can select it:

```css
@plugin "daisyui" {
  themes: light --default, dark --prefersdark, cyberpunk, retro, valentine, aqua;
}
```

Note that only *theme* colours follow a theme. `bg-teal-500` is a fixed palette
value and stays put; `bg-primary` and `.btn-primary` change.

## Attributes

| Attribute | Meaning |
| --- | --- |
| `position` | `"x y z"` in metres, world space |
| `rotation` | `"x y z"` in **degrees** (A-Frame's convention) |
| `scale` | `"x y z"`, defaults to `1 1 1` |

All of them, plus `class`, `style`, the page's theme, and the element's text, are
live: change one and the scene rebuilds on the next microtask.

## How it fits together

```
src/
  core/
    stage.ts        one scene/renderer/camera per document, created lazily
    interaction.ts  shared raycaster; mouse + XR controller rays
  style/
    computed.ts     getComputedStyle -> resolved Style; owns --xr-depth
    hover.ts        mirrors every :hover rule onto a class we can apply
    theme.ts        notices document-level style changes
    card.ts         extruded rounded-rect geometry + normal-baked shading
    fonts.ts        font weight -> bundled Inter file
    units.ts        design pixels <-> world units, card constants
  elements/
    base.ts         XRElement: transforms, lifecycle, invalidation, defaults
    xr-button.ts    <xr-button>
```

Design points worth knowing:

**The browser is the style engine.** See [Styling](#styling) — it's the whole
idea, and everything else follows from it.

**A button is one solid, not a face with a box behind it.** The body is a single
rounded-rectangle profile extruded through the depth, so the silhouette, the
corner radius and the side walls are the same shape by construction. Depth and
outline can't disagree, because there's only one of them.

**Nothing is rasterised.** The body is real geometry and the label is SDF text
via `troika-three-text`. Neither has a resolution, so both stay sharp with your
nose against them — which matters in a headset, where "zoomed all the way in" is
just leaning forward. Hover is a single uniform write, not a second texture.

**The label is painted on, not floated in front.** It sits exactly coplanar with
the front face and wins the depth test through a polygon offset. Even a fraction
of a millimetre of physical lift makes the text visibly detach from the button
when you look at it edge-on.

**Shading is baked from the normal, not lit.** There are no lights in the scene.
The card's fragment shader fades from the authored colour on the front face down
to 55% of it on the sides, keyed off the object-space normal. So `bg-teal-500` is
exactly `bg-teal-500` from every angle, and the solid still reads as a solid.

**Events are the browser's, not ours.** A raycaster hit dispatches a genuine
`MouseEvent` on the source element. Inline `onclick`, `addEventListener`, and
delegation from an ancestor all work unchanged — there is no custom event bus to
learn, and `event.target` is the element you wrote.

**The DOM element is config, the scene is rendering.** Source elements stay in
the document as `display: none`. They remain queryable and scriptable; they just
don't participate in 2D layout.

**Design pixels map to metres** via `PIXELS_PER_UNIT` (500, so 1 design pixel is
2 mm). That constant is set for legibility rather than tidiness: `text-base`
lands at ~1.2° of visual angle at 1.5 m, inside the comfortable range for reading
in a headset.

## Known gaps

- **No tests.** The single largest gap. A project whose whole claim is CSS
  fidelity has nothing that would catch fidelity regressing.
- **Computed values are not used values.** Reading resolved style gets you
  everything *except* layout: no resolved percentages, no `auto` widths, no
  intrinsic sizing, no wrapping. This is a consequence of the core design, not a
  missing feature — a container element with children that flow would mean either
  participating in real offscreen layout (giving up the properties `display:none`
  buys) or reimplementing a layout engine. That fork is undecided.
- **No layout, and one element.** Everything is positioned absolutely. No panel,
  text, image or container elements yet.
- **Rebuilds are all-or-nothing.** Any change disposes the geometry and re-syncs
  the label; a theme swap invalidates every element at once. A colour-only change
  should patch a uniform instead, and doesn't.
- **The hover mirror is the riskiest code here.** Nested rules, `@media`,
  `@supports`, `@layer` and `@import` are handled; `@scope`, named `@container`,
  anonymous layers and `:hover` inside `:is()`/`:not()` are not, and every failure
  mode is silent — hover just stops changing.
- **Borders and shadows are read as CSS but not drawn.** A daisyUI button will
  look flatter than it does on the page.
- **iOS Safari has no WebXR.** The scene still renders as an ordinary 3D canvas
  and the launcher says so, but there's no immersive mode on iPhone. A real
  fallback (App Clip, 8th Wall, or documented non-support) is still an open call.
- **Latin only.** Inter's latin subset is bundled, one file per weight. Other
  scripts render blank. troika can resolve fonts per script, but only through a
  CDN lookup this deliberately avoids — self-hosting that data is the fix.
- **No lighting, shadows or occlusion.** Shading is a fixed front-to-side
  falloff, so cards never pick up the colour of the room around them. That's a
  deliberate trade for exact colours; it will look flat next to lit content.
- **~2k triangles per button.** The extrusion is tessellated at 20 segments per
  corner. Fine for a panel of controls, worth revisiting for hundreds of them.
- **Hit-testing is linear.** Every pointer move intersects every registered mesh,
  with no spatial index.
- **The label is still its own mesh.** It's painted flush onto the front face via
  a polygon offset, so it reads as one object, but it is a second draw call.
  Genuinely merging it would mean sampling glyph SDFs inside the card shader and
  giving up troika's layout and font handling.
- **Layout is async.** troika measures text off the main thread, so a button
  exists for a frame or two before its card is sized and becomes clickable.
- **`position` is coordinates only.** No WebXR hit-test anchoring to real-world
  surfaces.
