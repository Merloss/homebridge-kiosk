import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ICONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public', 'icons');
const svg = fs.readFileSync(path.join(ICONS, 'icon.svg'));
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`;

const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}img{display:block}</style>` +
        `<img src="${src}" width="${size}" height="${size}">`
    );
    await page.locator('img').evaluate((img) => img.decode());
    const out = path.join(ICONS, `icon-${size}.png`);
    await page.screenshot({ path: out, omitBackground: true });
    console.log(`  ${path.relative(process.cwd(), out)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
