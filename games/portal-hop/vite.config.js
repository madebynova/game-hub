import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works when deployed under any path
  // (Netlify serves each game as its own site rooted at this folder).
  base: "./",
});
