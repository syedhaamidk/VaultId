import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build:  { outDir: 'dist' },
  // Force a single React copy. The vendored Saisei kit once shipped its own
  // nested node_modules with React 19, which produced a two-React bundle and
  // a blank page (minified React error #31). Dedupe makes that impossible.
  resolve: { dedupe: ['react', 'react-dom'] },
  test:   { environment: 'node', include: ['src/**/*.{test,spec}.{js,jsx}'] },
});
