import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    root: fileURLToPath(new URL('./web', import.meta.url)),
    base: process.env.PAGES_BASE_PATH || '/linjian-cottage/',
    publicDir: fileURLToPath(new URL('./public', import.meta.url)),
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    css: { postcss: { plugins: [tailwindcss()] } },
    define: { __GAME_API_URL__: JSON.stringify(process.env.GAME_API_URL || 'https://linjian-cottage.flowy-fern-2870.chatgpt.site/api/game') },
    build: { outDir: fileURLToPath(new URL('./pages-dist', import.meta.url)), emptyOutDir: true },
});
