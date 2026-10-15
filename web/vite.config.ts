/// <reference types="vitest/config" />
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base so the build works on a GitHub Pages project site (/<repo>/) or any sub-path.
export default defineConfig({
  base: "./",
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // Unit tests only; the Playwright tests in e2e/ have their own runner (npm run test:e2e).
  test: { include: ["src/**/*.test.ts"] },
});
