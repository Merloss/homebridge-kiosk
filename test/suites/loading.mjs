import { chromium } from 'playwright';
import { reporter, BASE, sleep } from '../helpers.mjs';

const { check, section, summary } = reporter();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 600 }, locale: 'en-US' });

async function slowPage(latency, throughput) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency,
    downloadThroughput: throughput,
    uploadThroughput: throughput,
  });
  return page;
}

section('Before the first data arrives');
const page = await slowPage(150, 500_000);
const frames = [];
page.goto(BASE, { waitUntil: 'commit' }).catch(() => {});

const t0 = Date.now();
while (Date.now() - t0 < 3500) {
  const frame = await page
    .evaluate(() => ({
      error: document.getElementById('errorbar')?.textContent.trim() ?? null,
      empty: !!document.getElementById('empty'),
      conn: document.querySelector('#conn .conn-text')?.textContent.trim() ?? null,
      tiles: document.querySelectorAll('.tile').length,
      loading: !!document.querySelector('#loading, .skeleton-tile'),
    }))
    .catch(() => null);
  if (frame) frames.push({ t: Date.now() - t0, ...frame });
  await sleep(60);
}

const firstData = frames.findIndex((f) => f.tiles > 0);
const before = firstData === -1 ? frames : frames.slice(0, firstData);
console.log(`  ${before.length} frames before data, data ${firstData === -1 ? 'never arrived' : `at ${frames[firstData].t}ms`}`);

const falseError = before.filter((f) => f.error);
const falseEmpty = before.filter((f) => f.empty);
check('no false "can\'t reach" error on first paint', falseError.length === 0,
  falseError.length ? `${falseError.length} frames, first at ${falseError[0].t}ms: "${falseError[0].error}"` : 'clean');
check('no false "no devices" on first paint', falseEmpty.length === 0,
  falseEmpty.length ? `${falseEmpty.length} frames, first at ${falseEmpty[0].t}ms` : 'clean');
check('something shows that it is loading',
  before.length === 0 || before.some((f) => f.loading || /connect/i.test(f.conn || '')),
  before.length ? `conn="${before[0].conn}" loading=${before[0].loading}` : 'window too short to sample');
check('the devices arrive', frames.at(-1).tiles > 0, `${frames.at(-1).tiles} tiles`);
await page.close();

section('The loading state itself');
{
  const slow = await slowPage(400, 200_000);
  slow.goto(BASE, { waitUntil: 'commit' }).catch(() => {});
  await slow.waitForSelector('#loading', { timeout: 8000 }).catch(() => {});
  const shown = await slow.evaluate(() => ({
    skeletons: document.querySelectorAll('.skeleton-tile').length,
    conn: document.querySelector('#conn .conn-text')?.textContent?.trim(),
    error: !!document.getElementById('errorbar'),
    empty: !!document.getElementById('empty'),
  }));
  check('skeleton tiles render', shown.skeletons > 0, `${shown.skeletons} skeletons`);
  check('the connection label says Connecting', /connect/i.test(shown.conn || ''), shown.conn);
  check('no error or empty state while loading', !shown.error && !shown.empty);
  await slow.close();
}

await browser.close();
process.exit(summary() ? 1 : 0);
