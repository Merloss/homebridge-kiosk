import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PORTS, startServer, startFakeHomebridge } from './helpers.mjs';

const SUITES = [
  { name: 'panel', needs: 'mock' },
  { name: 'grouping', needs: 'mock' },
  { name: 'i18n', needs: 'mock' },
  { name: 'component-page', needs: 'mock' },
  { name: 'loading', needs: 'mock' },
  { name: 'reload', needs: 'mock' },
  { name: 'theme', needs: 'mock' },
  { name: 'access-code', needs: null },
  { name: 'blink', needs: null },
  { name: 'failures', needs: 'fake' },
  { name: 'flicker', needs: 'fake' },
];

const wanted = process.argv.slice(2);
const unknown = wanted.filter((w) => !SUITES.some((s) => s.name === w));
if (unknown.length) {
  console.error(`Unknown suite: ${unknown.join(', ')}\nAvailable: ${SUITES.map((s) => s.name).join(', ')}`);
  process.exit(2);
}
if (!fs.existsSync(path.join(ROOT, 'web', 'dist', 'index.html'))) {
  console.error('web/dist is missing. Run "npm run build" first (npm test does it for you).');
  process.exit(2);
}
const selected = wanted.length ? SUITES.filter((s) => wanted.includes(s.name)) : SUITES;

const processes = [];
const servers = {};

async function serverFor(kind) {
  if (!kind) return {};
  if (servers[kind]) return servers[kind];
  if (kind === 'mock') {
    const mock = await startServer({ port: PORTS.mock, env: { HB_MOCK: '1' } });
    processes.push(mock);
    servers.mock = { KIOSK_TEST_URL: mock.url };
  } else {
    const hb = await startFakeHomebridge({ port: PORTS.fakeHomebridge });
    processes.push(hb);
    const panel = await startServer({
      port: PORTS.fakeServer,
      env: { HB_URL: hb.url, HB_USERNAME: 'test', HB_PASSWORD: 'test' },
    });
    processes.push(panel);
    servers.fake = { KIOSK_TEST_URL: panel.url, FAKE_HB_URL: hb.url };
  }
  return servers[kind];
}

function runSuite(name, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'test', 'suites', `${name}.mjs`)], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

const results = [];
try {
  for (const suite of selected) {
    console.log(`\n===== ${suite.name} =====`);
    const started = Date.now();
    const code = await runSuite(suite.name, await serverFor(suite.needs));
    results.push({ name: suite.name, ok: code === 0, secs: Math.round((Date.now() - started) / 1000) });
  }
} finally {
  await Promise.all(processes.map((p) => p.stop()));
}

console.log('\n===== summary =====');
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(16)} ${r.secs}s`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n  ${results.length - failed} of ${results.length} suites passed`);
process.exit(failed ? 1 : 0);
