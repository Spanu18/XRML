import * as THREE from 'three'
import { getStage, onFrame } from './stage.ts'

/**
 * A mesh that can be pointed at, plus the DOM element standing behind it.
 *
 * The element is the source of truth for events: a hit dispatches a real
 * `MouseEvent` on it, so inline `onclick=""`, `addEventListener`, and event
 * delegation on an ancestor all work with no custom event bus involved.
 */
export type Interactive = {
  object: THREE.Object3D
  source: HTMLElement
  setHovered: (hovered: boolean) => void
}

/** How far a pointer ray reaches, in world units. */
const RAY_LENGTH = 12

const targets: THREE.Object3D[] = []
const registry = new Map<THREE.Object3D, Interactive>()

/** Current hit per pointer — the mouse and each XR controller vote separately. */
const hoveredBy = new Map<string, THREE.Object3D | null>()
/** Objects currently hovered by at least one pointer. */
const hovered = new Set<THREE.Object3D>()

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const controllerMatrix = new THREE.Matrix4()

let initialized = false

function emit(source: HTMLElement, type: string, bubbles: boolean): void {
  source.dispatchEvent(
    new MouseEvent(type, { bubbles, cancelable: true, view: window }),
  )
}

/**
 * Recomputes whether an object is hovered by *any* pointer and fires the
 * transition if it changed. Pointers are counted rather than latched so a
 * second controller leaving doesn't cancel the first one's hover.
 */
function refresh(object: THREE.Object3D): void {
  const entry = registry.get(object)
  if (!entry) return

  let isHovered = false
  for (const candidate of hoveredBy.values()) {
    if (candidate === object) {
      isHovered = true
      break
    }
  }

  if (isHovered === hovered.has(object)) return

  if (isHovered) hovered.add(object)
  else hovered.delete(object)

  entry.setHovered(isHovered)
  // `mouseenter`/`mouseleave` don't bubble in the DOM either.
  emit(entry.source, isHovered ? 'mouseenter' : 'mouseleave', false)
}

function setHover(pointerId: string, object: THREE.Object3D | null): void {
  const previous = hoveredBy.get(pointerId) ?? null
  if (previous === object) return

  hoveredBy.set(pointerId, object)
  if (previous) refresh(previous)
  if (object) refresh(object)
}

function activate(object: THREE.Object3D): void {
  const entry = registry.get(object)
  if (entry) emit(entry.source, 'click', true)
}

function firstHit(): THREE.Object3D | null {
  if (targets.length === 0) return null
  const hits = raycaster.intersectObjects(targets, false)
  return hits.length > 0 ? hits[0].object : null
}

function setupMouse(): void {
  const { renderer, camera } = getStage()
  const canvas = renderer.domElement

  const update = (event: PointerEvent): void => {
    // In an immersive session the controllers own pointing; a stale mouse hover
    // would keep a button lit up behind your back.
    if (renderer.xr.isPresenting) return

    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(pointer, camera)
    const hit = firstHit()
    setHover('mouse', hit)
    canvas.style.cursor = hit ? 'pointer' : ''
  }

  canvas.addEventListener('pointermove', update)
  // Touch has no hover, so the press itself establishes the hit.
  canvas.addEventListener('pointerdown', update)
  canvas.addEventListener('pointerleave', () => {
    setHover('mouse', null)
    canvas.style.cursor = ''
  })
  canvas.addEventListener('click', () => {
    const object = hoveredBy.get('mouse')
    if (object) activate(object)
  })
}

function createRay(): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ])
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
  })
  return new THREE.Line(geometry, material)
}

function setupControllers(): void {
  const { renderer, scene } = getStage()

  const controllers: THREE.Group[] = []
  const rays: THREE.Line[] = []
  const pressed: Array<THREE.Object3D | null> = [null, null]

  for (let index = 0; index < 2; index += 1) {
    const id = `xr${index}`
    const controller = renderer.xr.getController(index)
    const ray = createRay()

    controller.visible = false
    controller.add(ray)
    scene.add(controller)

    controller.addEventListener('connected', () => {
      controller.visible = true
    })
    controller.addEventListener('disconnected', () => {
      controller.visible = false
      setHover(id, null)
    })
    controller.addEventListener('selectstart', () => {
      pressed[index] = hoveredBy.get(id) ?? null
    })
    controller.addEventListener('selectend', () => {
      const target = pressed[index]
      pressed[index] = null
      // Same press-and-release-on-the-same-target rule the browser uses.
      if (target && hoveredBy.get(id) === target) activate(target)
    })

    controllers.push(controller)
    rays.push(ray)
  }

  onFrame(() => {
    if (!renderer.xr.isPresenting) return

    for (let index = 0; index < controllers.length; index += 1) {
      const controller = controllers[index]
      const id = `xr${index}`

      if (!controller.visible) continue

      controllerMatrix.identity().extractRotation(controller.matrixWorld)
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
      raycaster.ray.direction
        .set(0, 0, -1)
        .applyMatrix4(controllerMatrix)
        .normalize()

      const hits = targets.length
        ? raycaster.intersectObjects(targets, false)
        : []
      const hit = hits.length > 0 ? hits[0] : null

      setHover(id, hit ? hit.object : null)
      rays[index].scale.z = hit ? hit.distance : RAY_LENGTH
    }
  })
}

function initialize(): void {
  if (initialized) return
  initialized = true
  setupMouse()
  setupControllers()
}

/** Adds a mesh to the shared hit-test set. */
export function registerInteractive(entry: Interactive): void {
  initialize()
  if (registry.has(entry.object)) return
  registry.set(entry.object, entry)
  targets.push(entry.object)
}

/**
 * Removes a mesh from the hit-test set and clears any hover state pointing at
 * it, so an element removed from the DOM while hovered doesn't leave a pointer
 * latched onto a mesh that no longer exists.
 */
export function unregisterInteractive(object: THREE.Object3D): void {
  const index = targets.indexOf(object)
  if (index !== -1) targets.splice(index, 1)

  registry.delete(object)
  hovered.delete(object)

  for (const [pointerId, candidate] of hoveredBy) {
    if (candidate === object) hoveredBy.set(pointerId, null)
  }
}
