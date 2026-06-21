import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

// Minimal config: we follow electron-vite's conventional layout, so entries are
// auto-detected — src/main/index.ts, src/preload/index.ts, src/renderer/index.html.
// This deliberately avoids __dirname / import.meta.url path math, which is fragile
// in a "type":"module" package (the bundled config can run as either CJS or ESM).
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
  },
});
