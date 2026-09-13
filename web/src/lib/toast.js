const listeners = new Set();

export function subscribeToast(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toast(message) {
  for (const listener of listeners) listener(message);
}
