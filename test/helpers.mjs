import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE_PORT = Number(process.env.TEST_PORT) || 8765;
export const PORTS = {
  mock: BASE_PORT,
  fakeHomebridge: BASE_PORT + 1,
  fakeServer: BASE_PORT + 2,
  spare: BASE_PORT + 3,
};
export const urlFor = (port) => `http://127.0.0.1:${port}`;

export const BASE = process.env.KIOSK_TEST_URL || urlFor(PORTS.mock);
export const FAKE_HB = process.env.FAKE_HB_URL || urlFor(PORTS.fakeHomebridge);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CLEAN_ENV = {
  HOST: '127.0.0.1',
  HB_URL: 'http://127.0.0.1:9',
  HB_USERNAME: '',
  HB_PASSWORD: '',
  HB_MOCK: '0',
  HB_POLL_INTERVAL: '2000',
  HB_IDLE_POLL_INTERVAL: '10000',
  KIOSK_TITLE: '',
  KIOSK_LOCALE: '',
  KIOSK_THEME: '',
  KIOSK_SCREENSAVER_AFTER: '0',
  KIOSK_HIDE_TYPES: '',
  KIOSK_ACCESS_CODE: '',
};

async function isUp(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

export async function waitFor(fn, ms = 15_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if (await fn()) return true;
    } catch {}
    await sleep(100);
  }
  return false;
}

export function stopProcess(proc) {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) return resolve();
    proc.once('exit', () => resolve());
    proc.kill();
  });
}

function spawnNode(script, { port, env }) {
  let output = '';
  const proc = spawn(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const keep = (chunk) => {
    output = (output + chunk).slice(-4000);
  };
  proc.stdout.on('data', keep);
  proc.stderr.on('data', keep);
  return { proc, url: urlFor(port), output: () => output, stop: () => stopProcess(proc) };
}

export async function startServer({ port, env = {} }) {
  if (await isUp(urlFor(port))) {
    throw new Error(`Port ${port} is already in use. Stop that process or set TEST_PORT.`);
  }
  const server = spawnNode('server/index.js', { port, env: { ...CLEAN_ENV, PORT: String(port), ...env } });
  const ok = await waitFor(async () => (await fetch(`${server.url}/healthz`)).ok);
  if (!ok) {
    await server.stop();
    throw new Error(`Server on port ${port} did not start:\n${server.output()}`);
  }
  return server;
}

export async function startFakeHomebridge({ port }) {
  if (await isUp(urlFor(port))) {
    throw new Error(`Port ${port} is already in use. Stop that process or set TEST_PORT.`);
  }
  const hb = spawnNode('test/fake-homebridge.mjs', { port, env: { FAKE_HB_PORT: String(port) } });
  const ok = await waitFor(async () => (await fetch(`${hb.url}/__control`, { method: 'POST', body: '{}' })).ok);
  if (!ok) {
    await hb.stop();
    throw new Error(`Fake Homebridge on port ${port} did not start:\n${hb.output()}`);
  }
  return hb;
}

export const getState = async (base = BASE) => (await fetch(`${base}/api/state`)).json();

export const srv = async (id, base = BASE) => (await getState(base)).devices.find((d) => d.id === id);

export const api = (id, characteristic, value, base = BASE) =>
  fetch(`${base}/api/set`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, characteristic, value }),
  });

export function reporter() {
  let pass = 0;
  let fail = 0;
  return {
    check(name, ok, detail = '') {
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
      if (ok) pass++;
      else fail++;
    },
    section(title) {
      console.log(`\n${title}`);
    },
    summary() {
      console.log(`\n  ${pass} passed, ${fail} failed`);
      return fail;
    },
  };
}

export async function boot(pathname = '/', opts = {}) {
  const base = opts.base || BASE;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 1024, height: 768 },
    hasTouch: true,
    locale: opts.locale ?? 'en-US',
    colorScheme: opts.colorScheme ?? 'dark',
  });
  if (opts.init) await ctx.addInitScript(...(Array.isArray(opts.init) ? opts.init : [opts.init]));
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(base + pathname, { waitUntil: 'networkidle' });
  if (opts.waitForTiles !== false) await page.waitForSelector('.tile', { timeout: 10_000 });

  const tile = (id) => page.locator(`[data-id="${id}"]`);

  async function boxOf(id) {
    await tile(id).scrollIntoViewIfNeeded();
    return tile(id).boundingBox();
  }

  const fill = (id) => page.$eval(`[data-id="${id}"] .tile-fill`, (el) => parseFloat(el.style.height) || 0);

  async function dragTile(id, { from = 0.85, to = 0.2, steps = 30, sample = true } = {}) {
    const box = await boxOf(id);
    const x = box.x + box.width / 2;
    const y0 = box.y + box.height * from;
    const y1 = box.y + box.height * to;
    const samples = [];

    await page.mouse.move(x, y0);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x, y0 + ((y1 - y0) * i) / steps);
      if (sample) samples.push(await fill(id));
    }
    const atRelease = await fill(id);
    await page.mouse.up();
    return { samples, atRelease };
  }

  async function openSheet(id) {
    const box = await boxOf(id);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await sleep(600);
    await page.mouse.up();
    await page.waitForSelector('#sheet', { timeout: 5000 });
    await sleep(400);
  }

  async function closeSheet() {
    if (await page.locator('#sheet [data-act="close"]').count()) {
      await page.locator('#sheet [data-act="close"]').click();
      await sleep(400);
    }
  }

  async function dragVSlider({ from = 0.8, to = 0.25, steps = 12 } = {}) {
    const box = await page.locator('#sheet .vslider').first().boundingBox();
    const x = box.x + box.width / 2;
    const y0 = box.y + box.height * from;
    const y1 = box.y + box.height * to;
    await page.mouse.move(x, y0);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x, y0 + ((y1 - y0) * i) / steps);
      await sleep(20);
    }
    await page.mouse.up();
  }

  return { browser, ctx, page, errors, tile, boxOf, fill, dragTile, openSheet, closeSheet, dragVSlider };
}
