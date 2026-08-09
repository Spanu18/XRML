# xrml

Spatial UI as native web components. Utility classes in, 3D buttons out — no
WebGL knowledge needed to use it, no framework required to install it.

```html
<xr-button
  class="bg-teal-500 hover:bg-teal-400 text-white p-4 rounded-lg text-lg"
  position="0 1.6 -1.5"
  onclick="doSomething()"
>Click me</xr-button>
```

That's the whole API surface for a button. `class` is parsed like Tailwind and
drawn onto a texture; `onclick` is a real inline handler that a real `MouseEvent`
triggers.

## Status

**v0 foundation.** One element (`<xr-button>`), the style pipeline behind it, and
the scene and interaction plumbing they sit on. Verified in headless Chromium:
renders, hover-swaps, dispatches native clicks that bubble, and rebuilds when the
DOM changes. Not published, not versioned, no framework wrappers.

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

## Supported utility classes

| Group | Tokens |
| --- | --- |
| Background | `bg-<color>`, `bg-transparent`, `bg-[#hex]` |
| Text colour | `text-<color>`, `text-[#hex]` |
| Text size | `text-xs` … `text-5xl` |
| Font weight | `font-light` … `font-extrabold` |
| Padding | `p-*`, `px-*`, `py-*`, `pt-*`, `pr-*`, `pb-*`, `pl-*` |
| Radius | `rounded`, `rounded-none\|sm\|md\|lg\|xl\|2xl\|3xl\|full` |
| Variant | `hover:` on any of the above |

Colours come from a curated palette in [src/style/tokens.ts](src/style/tokens.ts)
that mirrors Tailwind's naming (`teal-500`, `slate-700`, `white`). It's a subset —
extend it by adding rows, or sidestep it entirely with an arbitrary value like
`bg-[#7c3aed]`.

Unrecognised classes are ignored rather than reported, because the `class`
attribute is shared with ordinary CSS and an element may carry classes this
parser knows nothing about.

## Attributes

| Attribute | Meaning |
| --- | --- |
| `position` | `"x y z"` in metres, world space |
| `rotation` | `"x y z"` in **degrees** (A-Frame's convention) |
| `scale` | `"x y z"`, defaults to `1 1 1` |

All of them, plus `class` and the element's text, are live: change one and the
scene rebuilds on the next microtask.

## How it fits together

```
src/
  core/
    stage.ts        one scene/renderer/camera per document, created lazily
    interaction.ts  shared raycaster; mouse + XR controller rays
  style/
    tokens.ts       palette, spacing, radii, type scale, world-unit scale
    parse.ts        class string -> resolved base + hover styles
    card.ts         extruded rounded-rect geometry + normal-baked shading
    fonts.ts        font weight -> bundled Inter file
  elements/
    base.ts         XRElement: transforms, lifecycle, invalidation
    xr-button.ts    <xr-button>
```

Five design points worth knowing:

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

- **iOS Safari has no WebXR.** The scene still renders as an ordinary 3D canvas
  and the launcher says so, but there's no immersive mode on iPhone. A real
  fallback (App Clip, 8th Wall, or documented non-support) is still an open call.
- **Latin only.** Inter's latin subset is bundled, one file per weight. Other
  scripts render blank. troika can resolve fonts per script, but only through a
  CDN lookup this deliberately avoids — self-hosting that data is the fix.
- **`hover:` changes colour only.** `hover:bg-*` and `hover:text-<color>` work.
  Size-affecting tokens under `hover:` (`hover:text-lg`, `hover:p-6`) parse but
  aren't applied: resizing a card on hover would shift it out from under the
  pointer and oscillate.
- **No lighting, shadows or occlusion.** Shading is a fixed front-to-side
  falloff, so cards never pick up the colour of the room around them. That's a
  deliberate trade for exact colours; it will look flat next to lit content.
- **~2k triangles per button.** The extrusion is tessellated at 20 segments per
  corner. Fine for a panel of controls, worth revisiting for hundreds of them.
- **The label is still its own mesh.** It's painted flush onto the front face
  via a polygon offset, so it reads as one object, but it is a second draw call.
  Genuinely merging it would mean sampling glyph SDFs inside the card shader and
  giving up troika's layout and font handling.
- **Layout is async.** troika measures text off the main thread, so a button
  exists for a frame or two before its card is sized and becomes clickable.
- **No layout.** Every element is positioned absolutely. Flex-like stacking
  between elements isn't implemented.
- **One element.** No panel, text, image, or container elements yet.
- **`position` is coordinates only.** No WebXR hit-test anchoring to real-world
  surfaces.
