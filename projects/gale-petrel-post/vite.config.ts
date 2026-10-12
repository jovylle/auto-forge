import { defineConfig } from "vite";
// Kept minimal on purpose: this project builds with node build.mjs (no deps).
// base './' is REQUIRED for /p/<slug>/ subpath hosting — never change to '/'.
export default defineConfig({ base: "./" });
