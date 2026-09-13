import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, PORTS, startServer, sleep } from '../test/helpers.mjs';

const OUT = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const KIOSK = { width: 1024, height: 600 };
const PHONE = { width: 420, height: 820 };

const server = await startServer({ port: PORTS.spare, env: { HB_MOCK: '1' } });
const browser = await chromium.launch();

async function open(viewport, pathname = '/', { locale = 'en-US', colorScheme = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, locale, colorScheme });
  const page = await ctx.newPage();
  await page.goto(server.url + pathname, { waitUntil: 'networkidle' });
  await page.waitForSelector('.tile', { timeout: 10_000 });
  await sleep(900);
  return { page, ctx };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

async function openSheet(page, id) {
  const box = await page.locator(`[data-id="${id}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(600);
  await page.mouse.up();
  await page.waitForSelector('#sheet.visible');
  await sleep(600);
}

try {
  {
    const { page, ctx } = await open(KIOSK);
    await shot(page, '01-panel-dark');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(KIOSK, '/', { colorScheme: 'light' });
    await shot(page, '02-panel-light');
    await ctx.close();
  }
  {
    const { page, ctx } = await open({ width: 900, height: 1000 });
    await openSheet(page, 'mock-living-lamp');
    await shot(page, '03-sheet-light');
    await page.locator('#sheet [data-act="close"]').click();
    await sleep(500);
    await openSheet(page, 'mock-purifier');
    await shot(page, '04-sheet-grouped');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(KIOSK);
    await page.locator('[data-view="all"]').click();
    await sleep(700);
    await shot(page, '05-view-all');
    await page.locator('[data-view="grouped"]').click();
    await sleep(500);

    const box = await page.locator('[data-id="mock-living-lamp"]').boundingBox();
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height * 0.85);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(x, box.y + box.height * (0.85 - i * 0.05));
      await sleep(25);
    }
    await shot(page, '06-drag');
    await page.mouse.up();
    await sleep(400);

    await page.locator('.room-tab', { hasText: 'Living Room' }).click();
    await sleep(700);
    await shot(page, '07-room-filter');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(PHONE);
    await shot(page, '08-phone');
    await ctx.close();
  }
  {
    const { page, ctx } = await open({ width: 1100, height: 780 }, '/test.html');
    await sleep(600);
    await shot(page, '09-component-test');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(KIOSK, '/', { locale: 'tr-TR' });
    await shot(page, '10-panel-turkish');
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: KIOSK, locale: 'en-US', colorScheme: 'dark' });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400,
      downloadThroughput: 200_000,
      uploadThroughput: 200_000,
    });
    page.goto(server.url, { waitUntil: 'commit' }).catch(() => {});
    await page.waitForSelector('#loading', { timeout: 8000 });
    await shot(page, '11-loading');
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.stop();
}
