const SETTLE_MS = 1600;
const PINNED_MAX_MS = 30_000;

const holds = new Map();
const keyOf = (id, char) => `${id}:${char}`;

export function pin(id, char) {
  holds.set(keyOf(id, char), { until: Date.now() + PINNED_MAX_MS, pinned: true });
}

export function release(id, char) {
  holds.set(keyOf(id, char), { until: Date.now() + SETTLE_MS, pinned: false });
}

export function settle(id, char) {
  const hold = holds.get(keyOf(id, char));
  if (hold?.pinned) hold.until = Date.now() + PINNED_MAX_MS;
  else release(id, char);
}

export function confirm(id, char) {
  if (!holds.get(keyOf(id, char))?.pinned) holds.delete(keyOf(id, char));
}

export function clear(id, char) {
  holds.delete(keyOf(id, char));
}

export function isHeld(id, char) {
  const hold = holds.get(keyOf(id, char));
  if (hold && hold.until > Date.now()) return true;
  holds.delete(keyOf(id, char));
  return false;
}
