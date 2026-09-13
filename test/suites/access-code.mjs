import WebSocket from 'ws';
import { boot, reporter, startServer, PORTS } from '../helpers.mjs';

const CODE = 'test-code-4821';
const server = await startServer({ port: PORTS.spare, env: { HB_MOCK: '1', KIOSK_ACCESS_CODE: CODE } });
const { check, section, summary } = reporter();

function probeSocket(headers = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${server.url.replace('http', 'ws')}/ws`, { headers });
    const done = (result) => {
      clearTimeout(timer);
      ws.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => done('nothing'), 3000);
    ws.on('message', (raw) => done(`data:${JSON.parse(raw).devices?.length}`));
    ws.on('unexpected-response', (_req, res) => done(`rejected:${res.statusCode}`));
    ws.on('error', (e) => done(`error:${e.message}`));
  });
}

section('HTTP');
check('/api/state without the code is refused', (await fetch(`${server.url}/api/state`)).status === 401);
check('/api/set without the code is refused',
  (await fetch(`${server.url}/api/set`, { method: 'POST', body: '{}' })).status === 401);
check('/healthz stays open for health checks', (await fetch(`${server.url}/healthz`)).ok);
check('a wrong code is refused', (await fetch(`${server.url}/api/state?code=nope`)).status === 401);

const entry = await fetch(`${server.url}/?code=${CODE}`, { redirect: 'manual' });
const cookie = entry.headers.get('set-cookie') || '';
check('the right code sets a cookie and redirects', entry.status === 302 && cookie.startsWith('kiosk_code='), `${entry.status}`);
check('the cookie is HttpOnly', /;\s*HttpOnly/i.test(cookie), cookie.replace(CODE, '***'));

section('WebSocket');
const none = await probeSocket();
check('no code: the socket is refused', none === 'rejected:401', none);
const wrong = await probeSocket({ cookie: 'kiosk_code=nope' });
check('wrong code: the socket is refused', wrong === 'rejected:401', wrong);
const right = await probeSocket({ cookie: `kiosk_code=${CODE}` });
check('right code: the socket streams state', /^data:[1-9]/.test(right), right);

section('Browser');
{
  const { browser, ctx, page, errors } = await boot(`/?code=${CODE}`, { base: server.url });
  check('entering with ?code= loads the panel', (await page.locator('.tile').count()) > 0);
  check('it goes live over the socket', (await page.locator('#conn').getAttribute('class')).includes('online'));
  check('page scripts cannot read the code', !(await page.evaluate(() => document.cookie)).includes('kiosk_code'));
  const stored = (await ctx.cookies()).find((c) => c.name === 'kiosk_code');
  check('the browser stored it as HttpOnly', stored?.httpOnly === true);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.tile', { timeout: 10_000 });
  check('a reload without ?code= still works', (await page.locator('.tile').count()) > 0);
  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  const stranger = await (await browser.newContext()).newPage();
  const response = await stranger.goto(server.url);
  check('a browser without the code gets 401', response.status() === 401);
  await browser.close();
}

await server.stop();
process.exit(summary() ? 1 : 0);
