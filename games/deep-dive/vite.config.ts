import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any static host path (Netlify, GitHub Pages, file shares).
  base: './',
  server: { port: 5173 },
  preview: { port: 4173 },
});
