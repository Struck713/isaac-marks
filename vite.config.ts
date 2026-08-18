import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  // Relative base so the built dist/ also works opened straight from file://.
  base: "./",
  plugins: [solid()],
  build: {
    // Keep the bundle out of dist/assets/, which is the committed image bundle from public/.
    assetsDir: "bundle",
  },
});
