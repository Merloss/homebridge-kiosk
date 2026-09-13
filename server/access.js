import crypto from 'node:crypto';
import { config } from './config.js';

const COOKIE = 'kiosk_code';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function readCookie(req, name) {
  for (const pair of req.headers.cookie?.split(';') ?? []) {
    const [key, ...value] = pair.trim().split('=');
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join('='));
    } catch {
      return '';
    }
  }
  return '';
}

export function hasAccess(req) {
  if (!config.accessCode) return true;
  const url = new URL(req.url, 'http://kiosk');
  const given = Buffer.from(url.searchParams.get('code') || readCookie(req, COOKIE));
  const expected = Buffer.from(config.accessCode);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export function requireAccessCode(req, res, next) {
  if (!config.accessCode || req.path === '/healthz') return next();
  if (!hasAccess(req)) return res.status(401).type('text').send('Access code required: /?code=XXXX');

  if (req.query.code) {
    res.cookie(COOKIE, config.accessCode, { maxAge: ONE_YEAR_MS, httpOnly: true, sameSite: 'lax' });
    if (req.path === '/') return res.redirect('/');
  }
  next();
}
