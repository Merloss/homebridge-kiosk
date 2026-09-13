import { boot, sleep, reporter } from '../helpers.mjs';

const LOG_KEY = '__errorbar_log__';

function watchErrorBar(key) {
  const log = (event) => {
    try {
      const prev = JSON.parse(sessionStorage.getItem(key) || '[]');
      prev.push({ event, t: Math.round(performance.now()) });
      sessionStorage.setItem(key, JSON.stringify(prev));
    } catch {}
  };
  const start = () => {
    let visible = false;
    const look = () => {
      const has = !!document.getElementById('errorbar');
      if (has !== visible) {
        visible = has;
        log(has ? 'shown' : 'hidden');
      }
    };
    new MutationObserver(look).observe(document.documentElement, { childList: true, subtree: true });
    look();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  addEventListener('pagehide', () => log('pagehide'));
}

const { browser, page, errors } = await boot('/', { init: [watchErrorBar, LOG_KEY] });
const { check, section, summary } = reporter();

const readLog = () => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || '[]'), LOG_KEY);
const clearLog = () => page.evaluate((key) => sessionStorage.removeItem(key), LOG_KEY);
const describe = (log) => log.map((e) => `${e.event}@${e.t}ms`).join(' ') || 'empty';

for (const round of ['F5', 'second F5']) {
  section(round);
  await sleep(800);
  await clearLog();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.tile', { timeout: 10_000 });
  await sleep(1200);
  const log = await readLog();
  console.log(`  in-page log: ${describe(log)}`);
  const flashes = log.filter((e) => e.event === 'shown');
  check('the error bar never rendered', flashes.length === 0,
    flashes.length ? `rendered ${flashes.length}x at ${flashes.map((e) => `${e.t}ms`).join(', ')}` : 'clean');
  check('devices are back', (await page.locator('.tile').count()) > 0, `${await page.locator('.tile').count()} tiles`);
}

check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
process.exit(summary() ? 1 : 0);
