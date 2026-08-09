import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'

/**
 * `yarn dev` stays plain HTTP on localhost — which is a secure context, so
 * WebXR is fully available to a headset browsing to the machine directly.
 *
 * `yarn dev:xr` additionally exposes the server on the LAN over HTTPS. That's
 * required to test on a real headset: WebXR is `[SecureContext]`, and a plain
 * `http://192.168.x.x` origin is not secure, so `navigator.xr` would be
 * undefined there no matter how capable the device is.
 *
 * The certificate is self-signed, so the headset browser will show a warning
 * the first time. Accepting it is expected.
 */
const xrMode = process.env.XRML_HTTPS === '1'

export default defineConfig({
  plugins: xrMode ? [basicSsl(), tailwindcss()] : [tailwindcss()],
  server: xrMode ? { host: true } : {},
})
