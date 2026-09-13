import { useRef } from 'react';
import { adjust, finishAdjusting, startAdjusting } from '../lib/store.js';

export function useSliderDrag(device, char, valueAt) {
  const drag = useRef({ pointerId: null, value: null });
  const read = useRef(valueAt);
  read.current = valueAt;

  const end = (event) => {
    const d = drag.current;
    if (event.pointerId !== d.pointerId) return;
    d.pointerId = null;
    if (event.type === 'pointerup') d.value = read.current(event);
    finishAdjusting(device, char, d.value);
  };

  return {
    onPointerDown(event) {
      const d = drag.current;
      if (d.pointerId !== null) return;
      d.pointerId = event.pointerId;
      d.value = read.current(event);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      startAdjusting(device, char);
      adjust(device, char, d.value);
    },
    onPointerMove(event) {
      const d = drag.current;
      if (event.pointerId !== d.pointerId) return;
      d.value = read.current(event);
      adjust(device, char, d.value);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  };
}
