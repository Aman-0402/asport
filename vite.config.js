import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
const pages = ['index', 'about', 'skills', 'projects', 'certifications', 'contact'];

/**
 * Replaces `<!-- @include name -->` with the contents of partials/name.html.
 * Keeps nav, footer, and shared head markup in one place.
 */
function htmlPartials() {
  const pattern = /<!--\s*@include\s+([\w-]+)\s*-->/g;
  return {
    name: 'html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(pattern, (_, name) =>
          readFileSync(resolve(root, 'partials', `${name}.html`), 'utf8').trim()
        );
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.includes('partials')) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [htmlPartials()],
  build: {
    target: 'es2022',
    // three.js core lands in one lazy chunk (~130 kB gzip); only loaded when WebGL is available.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
