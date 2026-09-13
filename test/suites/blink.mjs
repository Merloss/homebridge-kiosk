import { boot, sleep, reporter, startServer, PORTS } from '../helpers.mjs';

const start = () => startServer({ port: PORTS.spare, env: { HB_MOCK: '1' } });

let server = await start();
const { browser, page, errors } = await boot('/', { base: server.url });
const { check, section, summary } = reporter();

await page.evaluate(() => {
  window.__errorLog = [];
  let visible = false;
  const look = () => {
    const has = !!document.getElementById('errorbar');
    if (has !== visible) {
      visible = has;
      window.__errorLog.push(has ? 'shown' : 'hidden');
    }
  };
  new MutationObserver(look).observe(document.documentElement, { childList: true, subtree: true });
  look();
});
const readLog = () => page.evaluate(() => window.__errorLog.slice());
const clearLog = () => page.evaluate(() => (window.__errorLog.length = 0));

await sleep(600);

section('A) Short outage (server restart)');
await clearLog();
await server.stop();
server = await start();
await sleep(2500);
const logA = await readLog();
console.log(`  log: ${logA.join(' ') || 'empty'}`);
check('a restart does not show the error bar', !logA.includes('shown'), `${logA.filter((e) => e === 'shown').length}x shown`);
check('the panel is intact afterwards', (await page.locator('.tile').count()) > 0);

section('B) Long outage (~4s)');
await clearLog();
await server.stop();
await sleep(4000);
const logB = await readLog();
console.log(`  log: ${logB.join(' ') || 'empty'}`);
check('a real outage DOES show the error bar', logB.includes('shown'));

server = await start();
await sleep(3000);
check('the error bar clears when the server is back', await page.evaluate(() => !document.getElementById('errorbar')));

const unexpected = errors.filter((e) => !/ERR_CONNECTION_REFUSED|WebSocket connection|Failed to load|502/i.test(e));
check('no unexpected console errors', unexpected.length === 0, unexpected.slice(0, 2).join(' | '));

await browser.close();
await server.stop();
process.exit(summary() ? 1 : 0);
