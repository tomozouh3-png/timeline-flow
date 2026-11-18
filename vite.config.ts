import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [...(command === "build" ? [viteSingleFile()] : [])],
  build: { target: "es2020", assetsInlineLimit: 100_000_000, cssCodeSplit: false },
  server: { port: 5181 },
}));
