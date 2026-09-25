import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // A second dev server (e.g. :5181 for testing) sets VITE_CACHE_DIR so it never
  // rewrites the optimized deps the main :5173 server is serving.
  cacheDir: process.env.VITE_CACHE_DIR || "node_modules/.vite",
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  // Routes are lazy-loaded, so without this Vite only discovers a route's
  // dependencies (recharts, react-hook-form, react-timezone-select, vaul…) the
  // first time that page opens, re-optimizes mid-session and briefly serves two
  // copies of React: "Invalid hook call" / "Cannot read properties of null
  // (reading 'useRef')" and a crashed page. Scanning every route up front
  // pre-bundles everything once at startup. Dev only — builds are unaffected.
  optimizeDeps: {
    entries: ["./app/root.tsx", "./app/routes/**/*.tsx", "./app/components/**/*.tsx"],
    include: [
      "recharts",
      "react-hook-form",
      "@hookform/resolvers/zod",
      "zod",
      "react-timezone-select",
      "react-big-calendar",
      "vaul",
      "cmdk",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "react-phone-number-input",
      "date-fns",
      "motion/react",
      "react-select",
      "react-day-picker",
      "@tanstack/react-table",
    ],
  },
});
