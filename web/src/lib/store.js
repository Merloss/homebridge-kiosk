import { isActive, isAlert } from './device.js';
import * as holds from './holds.js';
import { applyServerLocale, t } from './i18n.js';
import { applyTheme } from './theme.js';
import { toast } from './toast.js';

const SEND_THROTTLE_MS = 140;
const RESYNC_DELAY_MS = 250;

const state = {
  devices: [],
  rooms: [],
  scenes: [],
  ready: false,
  connected: false,
  error: null,
  updatedAt: 0,
  config: { title: '', locale: '', theme: 'auto', screensaverAfter: 120, mock: false },
};

export const getState = () => state;
export const getDevice = (id) => state.devices.find((device) => device.id === id);
export const isDemo = () => typeof window !== 'undefined' && Boolean(window.__KIOSK_DEMO_STATE__);

let version = 0;
const listeners = new Set();
const deviceVersions = new Map();
const deviceListeners = new Map();

export const getVersion = () => version;
export const getDeviceVersion = (id) => deviceVersions.get(id) ?? 0;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeDevice(id, listener) {
  if (!deviceListeners.has(id)) deviceListeners.set(id, new Set());
  const set = deviceListeners.get(id);
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0 && deviceListeners.get(id) === set) deviceListeners.delete(id);
  };
}

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

function notifyDevice(id) {
  deviceVersions.set(id, getDeviceVersion(id) + 1);
  for (const listener of deviceListeners.get(id) ?? []) listener();
}

export function notifyAll() {
  for (const device of state.devices) notifyDevice(device.id);
  notify();
}

function derive(device) {
  device.active = isActive(device);
  device.alert = isAlert(device);
  return device;
}

function merge(device, incoming, { optimistic = false } = {}) {
  const values = { ...incoming.values };
  for (const [char, local] of Object.entries(device.values)) {
    if (!holds.isHeld(device.id, char)) continue;
    if (!optimistic && Object.is(values[char], local)) holds.confirm(device.id, char);
    else values[char] = local;
  }
  Object.assign(device, incoming, { values });
  return derive(device);
}

export function applyState(data) {
  const known = new Map(state.devices.map((device) => [device.id, device]));
  state.devices = (data.devices ?? []).map((d) => (known.has(d.id) ? merge(known.get(d.id), d) : derive(d)));
  state.rooms = data.rooms ?? [];
  state.scenes = data.scenes ?? [];
  state.connected = Boolean(data.connected);
  state.error = data.error ?? null;
  state.updatedAt = data.updatedAt || state.updatedAt;
  state.config = data.config ?? state.config;
  state.ready = true;

  applyServerLocale(state.config.locale);
  applyTheme(state.config.theme);
  notifyAll();
}

export function applyPatch({ devices = [], optimistic = false }) {
  let added = false;
  for (const incoming of devices) {
    const device = getDevice(incoming.id);
    if (device) {
      merge(device, incoming, { optimistic });
    } else {
      state.devices.push(derive(incoming));
      added = true;
    }
    notifyDevice(incoming.id);
  }

  if (added || !state.ready || !state.connected || state.error) {
    Object.assign(state, { ready: true, connected: true, error: null });
    notify();
  }
}

export function setConnectionStatus(connected, error) {
  Object.assign(state, { ready: true, connected, error: connected ? null : error || t('unknownError') });
  notify();
}

export function markDisconnected() {
  state.connected = false;
  notify();
}

export function markReady() {
  if (state.ready) return;
  state.ready = true;
  notify();
}

export async function fetchState() {
  try {
    const res = await fetch('/api/state');
    if (res.ok) applyState(await res.json());
  } catch {}
}

let resyncTimer;
function resync() {
  clearTimeout(resyncTimer);
  resyncTimer = setTimeout(fetchState, RESYNC_DELAY_MS);
}

const CURRENT_STATE_OF = {
  LockTargetState: 'LockCurrentState',
  TargetPosition: 'CurrentPosition',
  TargetDoorState: 'CurrentDoorState',
  SecuritySystemTargetState: 'SecuritySystemCurrentState',
};

function setLocal(device, char, value) {
  device.values[char] = value;
  holds.settle(device.id, char);
}

const pendingSends = new Map();

async function send(device, char) {
  pendingSends.delete(`${device.id}:${char}`);
  try {
    const res = await fetch('/api/set', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: device.id, characteristic: char, value: device.values[char] }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  } catch (err) {
    toast(t('sendFailed', { err: err.message }));
    holds.clear(device.id, char);
    resync();
  }
}

export function setChar(device, char, value, { immediate = false } = {}) {
  setLocal(device, char, value);
  if (CURRENT_STATE_OF[char]) setLocal(device, CURRENT_STATE_OF[char], value);
  if (char === 'Brightness' && value > 0 && device.values.On === false) setLocal(device, 'On', true);
  derive(device);
  notifyDevice(device.id);

  if (isDemo()) return;
  const key = `${device.id}:${char}`;
  if (immediate) {
    clearTimeout(pendingSends.get(key));
    send(device, char);
  } else if (!pendingSends.has(key)) {
    pendingSends.set(key, setTimeout(() => send(device, char), SEND_THROTTLE_MS));
  }
}

const NEXT_VALUE = {
  On: (v) => !v.On,
  Active: (v) => (v.Active === 1 ? 0 : 1),
  LockTargetState: (v) => (v.LockCurrentState === 1 ? 0 : 1),
  TargetDoorState: (v) => (v.CurrentDoorState === 1 ? 0 : 1),
  TargetPosition: (v) => ((v.CurrentPosition ?? 0) > 0 ? 0 : 100),
};

export function toggle(device) {
  const next = NEXT_VALUE[device.primary];
  if (device.readOnly || !next) return false;
  setChar(device, device.primary, next(device.values), { immediate: true });
  return true;
}

export async function runScene(id) {
  const res = await fetch(`/api/scene/${encodeURIComponent(id)}`, { method: 'POST' });
  if (!res.ok) throw new Error(t('sceneFailed'));
  return res.json();
}

const COLOR_CHARS = new Set(['Hue', 'Saturation', 'ColorTemperature']);
const heldTogether = (char) => (char === 'Brightness' ? ['Brightness', 'On'] : [char]);

export function startAdjusting(device, char) {
  for (const c of heldTogether(char)) holds.pin(device.id, c);
}

export function adjust(device, char, value) {
  if ('On' in device.values) {
    if (char === 'Brightness') device.values.On = value > 0;
    else if (COLOR_CHARS.has(char)) device.values.On = true;
  }
  setChar(device, char, value);
}

export function finishAdjusting(device, char, value) {
  for (const c of heldTogether(char)) holds.release(device.id, c);
  if (char === 'Brightness' && device.caps.On?.write) setChar(device, 'On', value > 0, { immediate: true });
  setChar(device, char, value, { immediate: true });
}
