import { applyPatch, applyState, fetchState, isDemo, markDisconnected, markReady, setConnectionStatus } from './store.js';

const READY_TIMEOUT_MS = 6000;
const DISCONNECT_GRACE_MS = 1200;
const REST_POLL_MS = 8000;
const MAX_BACKOFF_STEP = 6;

let socket = null;
let retries = 0;
let disconnectTimer;
let unloading = false;

addEventListener('pagehide', () => {
  unloading = true;
});

addEventListener('pageshow', (event) => {
  unloading = false;
  if (event.persisted && (!socket || socket.readyState > WebSocket.OPEN)) openSocket();
});

function handleMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (message.type === 'state') applyState(message);
  else if (message.type === 'patch') applyPatch(message);
  else if (message.type === 'status') setConnectionStatus(Boolean(message.connected), message.error);
}

function openSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);
  socket = ws;

  ws.onopen = () => {
    retries = 0;
    clearTimeout(disconnectTimer);
  };
  ws.onmessage = (event) => handleMessage(event.data);
  ws.onerror = () => ws.close();
  ws.onclose = () => {
    if (unloading) return;
    clearTimeout(disconnectTimer);
    disconnectTimer = setTimeout(markDisconnected, DISCONNECT_GRACE_MS);
    retries = Math.min(retries + 1, MAX_BACKOFF_STEP);
    setTimeout(openSocket, 500 * 2 ** retries);
  };
}

export function startConnection() {
  if (isDemo()) {
    applyState({ ...window.__KIOSK_DEMO_STATE__, connected: true });
    return;
  }

  setTimeout(markReady, READY_TIMEOUT_MS);
  openSocket();
  setInterval(() => {
    if (socket?.readyState !== WebSocket.OPEN) fetchState();
  }, REST_POLL_MS);
}
