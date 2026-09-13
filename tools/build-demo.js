import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

import { createDemoState } from '../server/demo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2] || path.join(ROOT, 'demo.html');
const demoState = await createDemoState({ title: 'Home' });
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-demo-'));

const injectDemoState = {
  name: 'kiosk-demo-state',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) =>
      html.replace(
        '<div id="root"></div>',
        `<div id="root"></div>\n  <script>window.__KIOSK_DEMO_STATE__ = ${JSON.stringify(demoState).replace(/</g, '\\u003c')};</script>`
      ),
  },
};

await build({
  root: path.join(ROOT, 'web'),
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  plugins: [react(), viteSingleFile(), injectDemoState],
  build: { outDir, emptyOutDir: true, sourcemap: false, cssCodeSplit: false, assetsInlineLimit: 100_000_000 },
});

const html = fs
  .readFileSync(path.join(outDir, 'index.html'), 'utf8')
  .replace('<title>Homebridge Kiosk</title>', '<title>Homebridge Kiosk (demo)</title>');

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
fs.rmSync(outDir, { recursive: true, force: true });

console.log(`Demo written: ${output} (${(html.length / 1024).toFixed(1)} KB, ${demoState.devices.length} services)`);
