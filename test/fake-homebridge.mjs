import http from 'node:http';

const PORT = Number(process.env.FAKE_HB_PORT) || 8766;

const ch = (type, value, extra = {}) => ({
  type,
  value,
  format: extra.format || (typeof value === 'boolean' ? 'bool' : 'float'),
  canRead: true,
  canWrite: extra.canWrite !== false,
  minValue: extra.min,
  maxValue: extra.max,
  minStep: extra.step,
});

const BRIDGE = { name: 'fake', username: 'AA:BB:CC:DD:EE:FF', ipAddress: '127.0.0.1', port: 51900 };

function seed() {
  return [
    {
      aid: 10, instance: BRIDGE, uniqueId: 'f-lamp', serviceName: 'Test Lamp',
      humanType: 'Lightbulb', accessoryInformation: { Name: 'Test Lamp', Manufacturer: 'Fake' },
      serviceCharacteristics: [
        ch('On', true),
        ch('Brightness', 55, { format: 'int', min: 0, max: 100, step: 1 }),
      ],
    },
    {
      aid: 11, instance: BRIDGE, uniqueId: 'f-outlet', serviceName: 'Test Outlet',
      humanType: 'Outlet', accessoryInformation: { Name: 'Test Outlet', Manufacturer: 'Fake' },
      serviceCharacteristics: [ch('On', false)],
    },
    {
      aid: 12, instance: BRIDGE, uniqueId: 'f-sensor', serviceName: 'Test Temperature',
      humanType: 'Temperature Sensor', accessoryInformation: { Name: 'Test Temperature' },
      serviceCharacteristics: [ch('CurrentTemperature', 21.5, { canWrite: false })],
    },
  ];
}

const state = { accessories: seed(), drop: new Set(), failSet: false, down: false, lagMs: 0 };
const lagged = new Map();

const reported = (a, c) => {
  const lag = lagged.get(`${a.uniqueId}:${c.type}`);
  return lag && lag.until > Date.now() ? lag.oldValue : c.value;
};

const withValues = (a) => {
  const serviceCharacteristics = a.serviceCharacteristics.map((c) => ({ ...c, value: reported(a, c) }));
  const values = Object.fromEntries(serviceCharacteristics.map((c) => [c.type, c.value]));
  return { ...a, values, serviceCharacteristics };
};

function readJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve(null);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fake');
  const send = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === '/__control') {
    const cmd = await readJson(req);
    if (!cmd) return send(400, { error: 'invalid json' });
    if ('drop' in cmd) state.drop = new Set(cmd.drop);
    if ('failSet' in cmd) state.failSet = cmd.failSet;
    if ('down' in cmd) state.down = cmd.down;
    if ('lagMs' in cmd) state.lagMs = cmd.lagMs;
    return send(200, { ok: true, drop: [...state.drop], failSet: state.failSet, down: state.down, lagMs: state.lagMs });
  }

  if (state.down) {
    res.destroy();
    return;
  }

  if (url.pathname === '/api/auth/login') {
    return send(201, { access_token: 'fake-token', expires_in: 28800 });
  }
  if (url.pathname === '/api/accessories/layout') {
    return send(200, [{ name: 'Test Room', services: state.accessories.map((a) => ({ uniqueId: a.uniqueId })) }]);
  }
  if (url.pathname === '/api/accessories') {
    return send(200, state.accessories.filter((a) => !state.drop.has(a.uniqueId)).map(withValues));
  }
  if (url.pathname.startsWith('/api/accessories/') && req.method === 'PUT') {
    if (state.failSet) return send(500, { message: 'Device not responding' });
    const id = decodeURIComponent(url.pathname.split('/').pop());
    const body = await readJson(req);
    if (!body) return send(400, { error: 'invalid json' });
    const a = state.accessories.find((x) => x.uniqueId === id);
    const c = a?.serviceCharacteristics.find((x) => x.type === body.characteristicType);
    if (c) {
      if (state.lagMs > 0) {
        lagged.set(`${id}:${c.type}`, { oldValue: c.value, until: Date.now() + state.lagMs });
      }
      c.value = body.value;
    }
    return send(200, { value: body.value });
  }
  send(404, { message: 'not found' });
});

process.on('uncaughtException', (e) => console.error('[fake-homebridge] error:', e.message));
server.listen(PORT, '127.0.0.1', () => console.log(`[fake-homebridge] http://127.0.0.1:${PORT}`));
