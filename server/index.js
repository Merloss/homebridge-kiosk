import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';

import { hasAccess, requireAccessCode } from './access.js';
import { config, ROOT } from './config.js';
import { HomebridgeClient } from './homebridge.js';
import { MockClient } from './mock.js';
import { normalizeAll } from './normalize.js';

const DIST = path.join(ROOT, 'web', 'dist');
const LAYOUT_TTL_MS = 60_000;
const OFFLINE_POLL_MS = 5000;
const VERIFY_DELAY_MS = 350;
const HEARTBEAT_MS = 30_000;

const log = (message) => console.log(`[kiosk] ${message}`);

const client = config.mock ? new MockClient() : new HomebridgeClient(config.homebridge);

const state = {
  devices: [],
  rooms: [],
  scenes: loadScenes(),
  connected: false,
  error: null,
  updatedAt: 0,
};

let layout = [];
let layoutFetchedAt = 0;
let pollTimer;
let verifyTimer;

function loadScenes() {
  try {
    const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes.json'), 'utf8'));
    return Array.isArray(scenes) ? scenes : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[kiosk] could not read scenes.json:', err.message);
    return [];
  }
}

function publicState() {
  const { devices, rooms, scenes, connected, error, updatedAt } = state;
  return {
    devices,
    rooms,
    scenes: scenes.map(({ id, name, icon }) => ({ id, name, icon })),
    connected,
    error,
    updatedAt,
    config: { ...config.ui, mock: config.mock },
  };
}

async function fetchDevices() {
  if (Date.now() - layoutFetchedAt > LAYOUT_TTL_MS) {
    layout = (await client.getLayout()) ?? [];
    layoutFetchedAt = Date.now();
  }
  const { devices, rooms } = normalizeAll(await client.getAccessories(), layout);
  const isHidden = (device) => config.hiddenTypes.includes(device.humanType) || config.hiddenTypes.includes(device.type);
  const visible = devices.filter((device) => !isHidden(device));
  return { devices: visible, rooms: rooms.filter((room) => visible.some((device) => device.room === room)) };
}

async function refresh() {
  const wasConnected = state.connected;
  const hadError = state.error !== null;

  try {
    const { devices, rooms } = await fetchDevices();
    const previous = new Map(state.devices.map((device) => [device.id, JSON.stringify(device)]));
    const listChanged =
      devices.length !== state.devices.length || devices.some((device, i) => device.id !== state.devices[i].id);
    const changed = devices.filter((device) => previous.get(device.id) !== JSON.stringify(device));

    Object.assign(state, { devices, rooms, connected: true, error: null, updatedAt: Date.now() });

    if (!wasConnected || listChanged) {
      broadcast({ type: 'state', ...publicState() });
      if (hadError) log('Homebridge connection restored');
    } else if (changed.length > 0) {
      broadcast({ type: 'patch', devices: changed, updatedAt: state.updatedAt });
    }
  } catch (err) {
    if (wasConnected) console.error('[kiosk] Homebridge error:', err.message);
    Object.assign(state, { connected: false, error: err.message });
    broadcast({ type: 'status', connected: false, error: err.message });
  }
}

function schedulePoll() {
  clearTimeout(pollTimer);
  const interval = wss.clients.size > 0 ? config.pollInterval : config.idlePollInterval;
  const delay = state.connected ? interval : Math.max(interval, OFFLINE_POLL_MS);
  pollTimer = setTimeout(async () => {
    await refresh();
    schedulePoll();
  }, delay);
}

async function writeCharacteristic(id, characteristic, value) {
  await client.setCharacteristic(id, characteristic, value);

  const device = state.devices.find((d) => d.id === id);
  if (device) {
    device.values[characteristic] = value;
    broadcast({ type: 'patch', devices: [device], optimistic: true });
  }

  clearTimeout(verifyTimer);
  verifyTimer = setTimeout(refresh, VERIFY_DELAY_MS);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use(requireAccessCode);

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, connected: state.connected, devices: state.devices.length, mock: config.mock });
});

app.get('/api/state', (_req, res) => res.json(publicState()));

app.post('/api/set', async (req, res) => {
  const { id, characteristic, value } = req.body ?? {};
  if (!id || !characteristic) return res.status(400).json({ error: 'id and characteristic are required' });

  try {
    await writeCharacteristic(id, characteristic, value);
    res.json({ ok: true });
  } catch (err) {
    console.error('[kiosk] write failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/scene/:id', async (req, res) => {
  const scene = state.scenes.find((s) => s.id === req.params.id);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  const errors = [];
  for (const { deviceId, characteristic, value, delay } of scene.actions ?? []) {
    try {
      await writeCharacteristic(deviceId, characteristic, value);
      if (delay) await sleep(delay);
    } catch (err) {
      errors.push(`${deviceId}: ${err.message}`);
    }
  }
  await refresh();
  res.json({ ok: errors.length === 0, errors });
});

const hasBuild = fs.existsSync(path.join(DIST, 'index.html'));
if (!hasBuild) console.warn('[kiosk] web/dist is missing. Run "npm run build" first.');

app.use(
  express.static(DIST, {
    setHeaders(res, file) {
      const hashed = file.startsWith(path.join(DIST, 'assets'));
      res.setHeader('cache-control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  })
);

app.get('*', (_req, res) => {
  if (!hasBuild) return res.status(503).type('text').send('UI not built. Run "npm run build", then restart the server.');
  res.sendFile(path.join(DIST, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: ({ req }, done) => done(hasAccess(req), 401),
});

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });
  socket.send(JSON.stringify({ type: 'state', ...publicState() }));
  schedulePoll();
});

setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) {
      socket.terminate();
    } else {
      socket.isAlive = false;
      socket.ping();
    }
  }
}, HEARTBEAT_MS).unref();

if (!config.mock && !(config.homebridge.username && config.homebridge.password)) {
  console.error('[kiosk] HB_URL / HB_USERNAME / HB_PASSWORD missing. Run with HB_MOCK=1 to try it out.');
}

server.listen(config.port, config.host, async () => {
  log(`http://${config.host}:${config.port} (${config.mock ? 'MOCK' : config.homebridge.url})`);
  await refresh();
  log(`${state.devices.length} services, ${state.rooms.length} rooms`);
  schedulePoll();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearTimeout(pollTimer);
    clearTimeout(verifyTimer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
