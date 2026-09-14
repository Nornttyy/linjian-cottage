import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
import {ENTRY_CSS,ENTRY_MARKUP,ENTRY_WATCHDOG} from './lib/site-entry-shell';

export default defineConfig({
    root: fileURLToPath(new URL('./web', import.meta.url)),
    base: process.env.PAGES_BASE_PATH || '/linjian-cottage/',
    publicDir: fileURLToPath(new URL('./public', import.meta.url)),
    plugins: [react(),{name:'site-entry-shell',transformIndexHtml:html=>html.replace('<!--site-entry-style-->',`<style>${ENTRY_CSS}</style>`).replace('<!--site-entry-markup-->',`<div id="site-bootstrap">${ENTRY_MARKUP}</div><script>${ENTRY_WATCHDOG}</script>`)}],
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    css: { postcss: { plugins: [tailwindcss()] } },
    define: { __GAME_API_URL__: JSON.stringify(process.env.GAME_API_URL || 'https://linjian-cottage.flowy-fern-2870.chatgpt.site/api/game') },
    build: { outDir: fileURLToPath(new URL('./pages-dist', import.meta.url)), emptyOutDir: true },
});
