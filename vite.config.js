import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Dos salidas:
// - por defecto: un único HTML para Apps Script (gas/Index.html);
// - --mode pages: la app instalable para GitHub Pages (carpeta docs/), con
//   manifiesto e iconos para «Añadir a pantalla de inicio».
const PWA_HEAD = `
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" href="./icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Margen">`;

export default defineConfig(({ mode }) => mode === 'pages'
  ? {
      base: './',
      publicDir: 'pwa',
      build: { outDir: 'docs', emptyOutDir: true },
      plugins: [react(), { name: 'pwa-head', transformIndexHtml: (html) => html.replace('</head>', PWA_HEAD + '\n</head>') }],
    }
  : { publicDir: false, plugins: [react(), viteSingleFile()] });
