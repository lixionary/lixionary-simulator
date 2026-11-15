import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['mac-mini.fluffy-oratrice.ts.net'],
  },
  build: {
    rollupOptions: {
      input: {
        lensing: fileURLToPath(new URL('./gravitational-lensing/index.html', import.meta.url)),
        relativity: fileURLToPath(new URL('./gps-relativity/index.html', import.meta.url)),
        lens: fileURLToPath(new URL('./lens/index.html', import.meta.url)),
        life: fileURLToPath(new URL('./game-of-life/index.html', import.meta.url)),
        cpu: fileURLToPath(new URL('./cpu/index.html', import.meta.url)),
        collection: fileURLToPath(new URL('./index.html', import.meta.url)),
        lte: fileURLToPath(new URL('./4g-lte/index.html', import.meta.url)),
        sun: fileURLToPath(new URL('./apparent-annual-motion/index.html', import.meta.url)),
        osi: fileURLToPath(new URL('./osi/index.html', import.meta.url)),
        errors: fileURLToPath(new URL('./error-detection/index.html', import.meta.url)),
      },
    },
  },
  test: { include: ['gravitational-lensing/src/**/*.test.ts', 'gps-relativity/src/**/*.test.ts', 'lens/src/**/*.test.ts', 'game-of-life/src/**/*.test.ts', 'cpu/src/**/*.test.ts', 'osi/src/**/*.test.ts', '4g-lte/src/**/*.test.ts', 'apparent-annual-motion/src/**/*.test.ts', 'error-detection/src/**/*.test.ts'] },
});
