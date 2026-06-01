import { defineConfig } from 'vite';

// GitHub Pages serves this project at https://otiumtec.github.io/Amoeba/, so the
// production build needs a matching base path. Dev stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Amoeba/' : '/',
}));
