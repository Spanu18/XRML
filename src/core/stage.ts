import * as THREE from 'three'

/**
 * The shared scene every spatial element renders into.
 *
 * There is exactly one per document, created lazily the first time an element
 * connects, so a page that never uses a spatial element never pays for a WebGL
 * context.
 */
export type Stage = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
}

export type FrameCallback = (delta: number) => void

const BACKGROUND = 0x0b1020

let stage: Stage | null = null
const frameCallbacks: FrameCallback[] = []

function create(): Stage {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BACKGROUND)

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.01,
    100,
  )
  // Standing eye height, looking down -Z. Matches the `local-floor` reference
  // space so authored positions mean the same thing in and out of a session.
  camera.position.set(0, 1.6, 0)

  // `alpha` matters for AR: on session start we drop to a transparent clear so
  // the passthrough camera feed shows through.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType('local-floor')

  const canvas = renderer.domElement
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.zIndex = '0'
  document.body.appendChild(canvas)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const clock = new THREE.Timer()
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta()
    for (const callback of frameCallbacks) callback(delta)
    renderer.render(scene, camera)
  })

  return { scene, camera, renderer }
}

export function getStage(): Stage {
  if (!stage) stage = create()
  return stage
}

/** Runs `callback` once per rendered frame, before the draw call. */
export function onFrame(callback: FrameCallback): void {
  frameCallbacks.push(callback)
}

/** Max anisotropy the current context supports, for crisper glancing-angle text. */
export function maxAnisotropy(): number {
  return getStage().renderer.capabilities.getMaxAnisotropy()
}

async function supports(xr: XRSystem, mode: XRSessionMode): Promise<boolean> {
  try {
    return await xr.isSessionSupported(mode)
  } catch {
    return false
  }
}

/**
 * Why an immersive session isn't available, when it isn't.
 *
 * These are worth telling apart: "no headset" is expected on a desktop, but
 * "insecure" looks identical from the user's side and is nearly always a fixable
 * mistake — reaching a dev server at `http://192.168.x.x` rather than over
 * HTTPS. WebXR is `[SecureContext]`, so on a plain-HTTP LAN address
 * `navigator.xr` is undefined and even a real headset reports nothing.
 */
export type XRAvailability =
  | { mode: XRSessionMode }
  | { mode: null; reason: 'insecure' | 'unsupported' | 'no-device' }

/** Prefers AR (passthrough) when the device offers both. */
async function detectMode(): Promise<XRAvailability> {
  const xr = navigator.xr

  if (!xr) {
    // A secure context with no `navigator.xr` means the browser has no WebXR;
    // an insecure one hides the API regardless of what the browser supports.
    return { mode: null, reason: window.isSecureContext ? 'unsupported' : 'insecure' }
  }

  if (await supports(xr, 'immersive-ar')) return { mode: 'immersive-ar' }
  if (await supports(xr, 'immersive-vr')) return { mode: 'immersive-vr' }
  return { mode: null, reason: 'no-device' }
}

const UNAVAILABLE: Record<
  'insecure' | 'unsupported' | 'no-device',
  { label: string; title: string }
> = {
  insecure: {
    label: 'Needs HTTPS',
    title:
      'WebXR only exists in a secure context. This page is on plain HTTP over ' +
      'a non-localhost address, so navigator.xr is undefined even if the ' +
      'device supports WebXR. Serve over HTTPS — see `yarn dev:xr`.',
  },
  unsupported: {
    label: 'No WebXR here',
    title:
      'This browser exposes no WebXR API. No macOS browser ships immersive ' +
      'WebXR, and iPhone Safari has none either.',
  },
  'no-device': {
    label: 'No headset detected',
    title:
      'WebXR is available but no immersive device is connected, so neither ' +
      'immersive-ar nor immersive-vr is supported.',
  },
}

/**
 * Adds a session entry button to `parent`.
 *
 * When no immersive session is available the button stays disabled and says so
 * — most visibly on iPhone Safari, which as of 2026 still ships no WebXR at
 * all. The scene itself keeps rendering as an ordinary 3D canvas there.
 */
export function mountXRLauncher(parent: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'xr-launch'
  button.disabled = true
  button.textContent = 'Checking WebXR…'
  parent.appendChild(button)

  const { renderer } = getStage()
  let session: XRSession | null = null

  void detectMode().then((availability) => {
    if (availability.mode === null) {
      const { label, title } = UNAVAILABLE[availability.reason]
      button.textContent = label
      button.title = `${title} The scene still renders as an ordinary 3D canvas.`
      return
    }

    const mode = availability.mode
    const label = mode === 'immersive-ar' ? 'Enter AR' : 'Enter VR'
    button.disabled = false
    button.textContent = label

    button.addEventListener('click', async () => {
      if (session) {
        await session.end()
        return
      }

      button.disabled = true
      try {
        session = await navigator.xr!.requestSession(mode, {
          optionalFeatures: [
            'local-floor',
            'bounded-floor',
            'hand-tracking',
            'hit-test',
          ],
        })
      } catch {
        button.disabled = false
        button.textContent = 'Session refused'
        return
      }

      // Passthrough needs the scene background out of the way.
      if (mode === 'immersive-ar') {
        getStage().scene.background = null
        renderer.setClearAlpha(0)
      }

      session.addEventListener('end', () => {
        session = null
        getStage().scene.background = new THREE.Color(BACKGROUND)
        renderer.setClearAlpha(1)
        button.textContent = label
      })

      await renderer.xr.setSession(session)
      button.disabled = false
      button.textContent = 'Exit'
    })
  })

  return button
}
