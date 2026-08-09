import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getStage, mountXRLauncher, onFrame } from './core/stage.ts'
import './elements/xr-button.ts'

declare global {
  interface Window {
    xrmlLog: (label: string) => void
  }
}

const stage = getStage()

// A floor gives the scene a sense of scale outside a headset, where there's no
// room-scale tracking to anchor against.
stage.scene.add(new THREE.GridHelper(12, 24, 0x1e293b, 0x141c2e))

const controls = new OrbitControls(stage.camera, stage.renderer.domElement)
controls.target.set(0, 1.45, -1.6)
controls.enableDamping = true
stage.camera.position.set(0, 1.6, 0.1)
controls.update()
onFrame(() => controls.update())

mountXRLauncher(document.querySelector<HTMLElement>('#chrome')!)

const log = document.querySelector<HTMLElement>('#log')!
let clicks = 0
let lastLabel = 'nothing yet'

// Inline `onclick=""` in the markup resolves against the global scope exactly
// as it would on a normal page — the raycaster dispatches a real MouseEvent and
// the browser does the rest. This runs first, at the target phase.
window.xrmlLog = (label: string) => {
  lastLabel = label
}

// Then the same event bubbles to the document, so ordinary delegation works.
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement
  if (target.tagName !== 'XR-BUTTON') return
  clicks += 1
  log.textContent = `${lastLabel} · ${clicks} click${clicks === 1 ? '' : 's'}`
})
