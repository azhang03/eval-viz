import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the site also works from a sub-path (GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // three.js alone is about 540 kB (135 kB gzip) and cannot be split. Any other chunk this big still warns.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Libraries go in their own chunks. They change less often than the site code, so the
        // browser can keep them in its cache after a site update.
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules[\\/]three[\\/]/ },
            { name: "vendor", test: /node_modules[\\/](react|react-dom|scheduler|gsap)[\\/]/ },
          ],
        },
      },
    },
  },
});
