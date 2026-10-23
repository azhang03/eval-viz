import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the site also works from a sub-path (GitHub Pages).
export default defineConfig({
  base: "./",
  plugins: [react()],
});
