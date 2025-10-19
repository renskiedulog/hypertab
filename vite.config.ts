import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    minify: false,
    outDir: "extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        newtab: path.resolve(__dirname, "index.html"),
        background: path.resolve(__dirname, "script/background.js"),
        "youtube-analyzer": path.resolve(
          __dirname,
          "script/youtube-analyzer.js"
        ),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
