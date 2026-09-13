import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const read = (name) => process.env[name]?.trim() ?? '';

const text = (name, fallback = '') => read(name) || fallback;

const number = (name, fallback) => {
  const value = Number(read(name));
  return read(name) !== '' && Number.isFinite(value) ? value : fallback;
};

const flag = (name) => ['1', 'true', 'yes', 'on'].includes(read(name).toLowerCase());

const list = (name) =>
  read(name)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const oneOf = (name, allowed, fallback) => (allowed.includes(read(name)) ? read(name) : fallback);

export const config = {
  port: number('PORT', 8080),
  host: text('HOST', '0.0.0.0'),
  mock: flag('HB_MOCK') || process.argv.includes('--mock'),

  homebridge: {
    url: text('HB_URL', 'http://localhost:8581').replace(/\/+$/, ''),
    username: text('HB_USERNAME'),
    password: text('HB_PASSWORD'),
  },
  pollInterval: number('HB_POLL_INTERVAL', 2000),
  idlePollInterval: number('HB_IDLE_POLL_INTERVAL', 10_000),

  accessCode: text('KIOSK_ACCESS_CODE'),
  hiddenTypes: list('KIOSK_HIDE_TYPES'),

  ui: {
    title: text('KIOSK_TITLE'),
    locale: text('KIOSK_LOCALE'),
    theme: oneOf('KIOSK_THEME', ['auto', 'dark', 'light'], 'auto'),
    screensaverAfter: number('KIOSK_SCREENSAVER_AFTER', 120),
  },
};
