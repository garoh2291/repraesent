import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // A second dev server (e.g. :5181 for testing) sets VITE_CACHE_DIR so it never
  // rewrites the optimized deps the main :5173 server is serving.
  cacheDir: process.env.VITE_CACHE_DIR || "node_modules/.vite",
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
