import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "pdfjs-worker": path.resolve(
        __dirname,
        "node_modules/pdfjs-dist/build/pdf.worker.mjs"
      ),
    },
  },
  optimizeDeps: {
    include: ["pdfjs-dist"],
  },
  build: {
    commonjsOptions: {
      include: [/pdfjs-dist/],
    },
  },
});
