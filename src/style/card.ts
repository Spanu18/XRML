import * as THREE from 'three'

/**
 * The card is a real extruded solid, not a flat face with a block hidden behind
 * it. One rounded-rectangle profile is swept through the depth, so the
 * silhouette, the corner radius and the sides are the same shape by
 * construction — they can't drift apart the way a face and a separate backing
 * box did.
 *
 * Shading is baked from the object-space normal rather than scene lights: the
 * front face returns the authored colour exactly, while the sides and bevel fall
 * off toward `uShadeMin`. That keeps `bg-teal-500` looking like `bg-teal-500`
 * from every angle while still reading as a solid object.
 */
export type CardMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uColor: { value: THREE.Color }
    uOpacity: { value: number }
    uShadeMin: { value: number }
  }
}

/**
 * Segments per 90° corner arc. At 20 the flat-to-curve error on a 16mm radius
 * is around 0.01mm — under a pixel even with your nose against it.
 */
const CURVE_SEGMENTS = 20

/** Rings across the bevel. Two is enough to read as a chamfer, not a crease. */
const BEVEL_SEGMENTS = 2

const vertexShader = /* glsl */ `
varying float vFaceness;

void main() {
  // Object space on purpose: the front face stays the front face no matter how
  // the element is rotated or where it's viewed from.
  vFaceness = clamp(normal.z, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uShadeMin;

varying float vFaceness;

void main() {
  if (uOpacity < 0.002) discard;

  float shade = mix(uShadeMin, 1.0, vFaceness);

  gl_FragColor = vec4(uColor * shade, uOpacity);
  #include <colorspace_fragment>
}
`

/** Traces a rounded rectangle centred on the origin. */
function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const r = Math.min(radius, halfWidth, halfHeight)
  const shape = new THREE.Shape()

  if (r <= 0) {
    shape.moveTo(-halfWidth, -halfHeight)
    shape.lineTo(halfWidth, -halfHeight)
    shape.lineTo(halfWidth, halfHeight)
    shape.lineTo(-halfWidth, halfHeight)
    shape.closePath()
    return shape
  }

  shape.moveTo(-halfWidth + r, -halfHeight)
  shape.lineTo(halfWidth - r, -halfHeight)
  shape.absarc(halfWidth - r, -halfHeight + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(halfWidth, halfHeight - r)
  shape.absarc(halfWidth - r, halfHeight - r, r, 0, Math.PI / 2, false)
  shape.lineTo(-halfWidth + r, halfHeight)
  shape.absarc(-halfWidth + r, halfHeight - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-halfWidth, -halfHeight + r)
  shape.absarc(-halfWidth + r, -halfHeight + r, r, Math.PI, Math.PI * 1.5, false)
  shape.closePath()

  return shape
}

/**
 * Builds the card solid. `width`, `height` and `depth` describe the finished
 * object including its bevel, and the front face lands on z = 0 so callers can
 * place a label without knowing how the extrusion was assembled.
 */
export function createCardGeometry(
  width: number,
  height: number,
  radius: number,
  depth: number,
  bevel: number,
): THREE.ExtrudeGeometry {
  // A bevel grows the profile outwards on every axis, so shrink by exactly that
  // much first and the finished solid lands on the requested dimensions.
  const inset = Math.max(
    Math.min(bevel, width / 2, height / 2, depth / 2),
    0,
  )
  const innerWidth = Math.max(width - inset * 2, 1e-5)
  const innerHeight = Math.max(height - inset * 2, 1e-5)
  const innerRadius = Math.max(Math.min(radius - inset, innerWidth / 2, innerHeight / 2), 0)

  const geometry = new THREE.ExtrudeGeometry(
    roundedRect(innerWidth, innerHeight, innerRadius),
    {
      depth: Math.max(depth - inset * 2, 1e-5),
      bevelEnabled: inset > 0,
      bevelThickness: inset,
      bevelSize: inset,
      bevelOffset: 0,
      bevelSegments: BEVEL_SEGMENTS,
      curveSegments: CURVE_SEGMENTS,
    },
  )

  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (bounds) geometry.translate(0, 0, -bounds.max.z)

  return geometry
}

export function createCardMaterial(
  color: THREE.Color,
  opacity: number,
  shadeMin: number,
  blended: boolean,
): CardMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    // Solid cards stay opaque so they sort and depth-test like ordinary
    // geometry; only a transparent background needs blending.
    transparent: blended,
    depthWrite: !blended,
    uniforms: {
      uColor: { value: color },
      uOpacity: { value: opacity },
      uShadeMin: { value: shadeMin },
    },
  })

  return material as CardMaterial
}
