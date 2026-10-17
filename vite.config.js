import { defineConfig } from 'vite';

// GitHub Pages serves the site from /retail-portfolio/.
// three.js lives in its own lazily loaded chunk (desktop 3D only), so its size is expected.
export default defineConfig({ base: '/retail-portfolio/', build: { chunkSizeWarningLimit: 650 } });
