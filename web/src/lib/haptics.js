export function haptic(durationMs = 12) {
  navigator.vibrate?.(durationMs);
}
