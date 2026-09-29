import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The landing page renders the extension's real side panel. `wxt/browser` is swapped for an in-memory
// stand-in so the panel runs on a normal web page with no extension APIs.
export default defineConfig({
  root: here('.'),
  // Site-only files (favicon, social image). Icons are imported from ../public so the extension zip stays lean.
  publicDir: here('./public'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': here('../src'),
      'wxt/browser': here('./browser-stub.ts'),
    },
  },
  build: {
    outDir: here('./dist'),
    emptyOutDir: true,
    // The landing page, and the real panel it embeds in the scroll story.
    rollupOptions: { input: { main: here('./index.html'), panel: here('./panel.html') } },
  },
});
