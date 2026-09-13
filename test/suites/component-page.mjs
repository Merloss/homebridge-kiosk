import { boot, sleep, reporter } from '../helpers.mjs';

const { browser, page, errors, fill, dragTile } = await boot('/test.html');
const { check, section, summary } = reporter();

const requests = [];
page.on('request', (r) => {
  const { pathname } = new URL(r.url());
  if (pathname.startsWith('/api/') || pathname === '/ws') requests.push(pathname);
});
page.on('websocket', (ws) => requests.push(`ws:${ws.url()}`));

section('Structure');
const tiles = await page.locator('.tile').count();
const items = await page.locator('.devbar-item').count();
const labelCount = Number((await page.locator('.devbar-toggle').textContent()).match(/(\d+)/)?.[1]);

check('tiles render', tiles > 0, `${tiles} tiles`);
check('room tabs render', (await page.locator('.room-tab').count()) > 1);
check('scenes render', (await page.locator('.scene').count()) === 3);
check('the test bar is there', (await page.locator('.devbar').count()) === 1);
check('one button per service', items === labelCount && items >= tiles, `${items} buttons, label says ${labelCount}`);
check('grouped view: the purifier is a single tile',
  (await page.locator('[data-id="mock-purifier"]').count()) === 1 &&
    (await page.locator('[data-id="mock-purifier-buzzer"]').count()) === 0);
check('grouping reduces the tile count', tiles < items, `${tiles} tiles < ${items} services`);

await page.locator('[data-view="all"]').click();
await sleep(400);
const allTiles = await page.locator('.tile').count();
check('the All view works here too', allTiles > tiles, `${tiles} -> ${allTiles} tiles`);
await page.locator('[data-view="grouped"]').click();
await sleep(400);

section('Every sheet');
const COMPONENTS = ['[data-act="power"]', '.vslider', '.hslider', '.thermo', '[data-act="mode"]', '[data-act="set"]', '.kv'];
const seen = new Set();
const unopened = [];
for (let i = 0; i < items; i++) {
  await page.locator('.devbar-item').nth(i).click();
  await sleep(150);
  if ((await page.locator('#sheet').count()) === 0) {
    unopened.push(i);
    continue;
  }
  for (const sel of COMPONENTS) {
    if (await page.locator(`#sheet ${sel}`).count()) seen.add(sel);
  }
}
console.log(`  components seen: ${[...seen].join('  ')}`);
check('every sheet opens', unopened.length === 0, unopened.length ? `items ${unopened.join(', ')}` : `${items} sheets`);
check('every sheet component renders', seen.size === COMPONENTS.length, `${seen.size}/${COMPONENTS.length}`);

section('Drag');
await page.keyboard.press('Escape');
await sleep(400);
const before = await fill('mock-living-lamp');
const { samples, atRelease } = await dragTile('mock-living-lamp');
let jumps = 0;
for (let i = 1; i < samples.length; i++) if (samples[i] < samples[i - 1] - 0.5) jumps++;
check('dragging works on the test page', atRelease !== before, `${before}% -> ${atRelease}%`);
check('no jumps back during the drag', jumps === 0, `${jumps} jumps`);

await sleep(1000);
check('the page made NO network requests', requests.length === 0, requests.join(', ') || 'none');
check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
process.exit(summary() ? 1 : 0);
