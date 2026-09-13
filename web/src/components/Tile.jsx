import { useRef, useState } from 'react';
import { BatteryLow } from 'lucide-react';
import { useDevice } from '../hooks/useStore.js';
import { clamp, dragTarget, fillLevel, statusText } from '../lib/device.js';
import { haptic } from '../lib/haptics.js';
import { t } from '../lib/i18n.js';
import { adjust, finishAdjusting, startAdjusting, toggle } from '../lib/store.js';
import { DeviceIcon } from './DeviceIcon.jsx';

const LONG_PRESS_MS = 450;
const DRAG_THRESHOLD_PX = 10;
const LOW_BATTERY_PERCENT = 30;
const COOL_TYPES = new Set(['heatercooler', 'cover']);

export function Tile({ id, label, onOpenSheet, onWake }) {
  const device = useDevice(id);
  const [pressing, setPressing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef(null);

  if (!device) return null;

  function onPointerDown(event) {
    if (gesture.current) return;
    onWake?.();

    const target = dragTarget(device);
    const g = {
      pointerId: event.pointerId,
      startY: event.clientY,
      target,
      startValue: target ? Number(device.values[target.char] ?? 0) : 0,
      moved: false,
      dragging: false,
      opened: false,
    };
    g.timer = setTimeout(() => {
      if (g.moved) return;
      g.opened = true;
      setPressing(false);
      haptic(18);
      onOpenSheet(id);
    }, LONG_PRESS_MS);

    gesture.current = g;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPressing(true);
  }

  function onPointerMove(event) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.pointerId || g.opened) return;

    const dy = g.startY - event.clientY;
    if (!g.moved && Math.abs(dy) > DRAG_THRESHOLD_PX) {
      g.moved = true;
      clearTimeout(g.timer);
      if (g.target) {
        g.dragging = true;
        setDragging(true);
        setPressing(false);
        startAdjusting(device, g.target.char);
        haptic(8);
      }
    }
    if (!g.dragging) return;

    const { char, min, max, step } = g.target;
    const height = event.currentTarget.getBoundingClientRect().height;
    const raw = clamp(g.startValue + (dy / (height * 0.9)) * (max - min), min, max);
    const value = Math.round(raw / step) * step;
    if (value !== device.values[char]) adjust(device, char, value);
  }

  function onPointerEnd(event) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.pointerId) return;
    gesture.current = null;
    clearTimeout(g.timer);
    setPressing(false);

    if (g.dragging) {
      setDragging(false);
      finishAdjusting(device, g.target.char, device.values[g.target.char]);
      return;
    }
    if (g.opened || g.moved || event.type === 'pointercancel') return;

    haptic();
    if (!toggle(device)) onOpenSheet(id);
  }

  const className = [
    'tile',
    device.active && 'on',
    device.alert && 'alert',
    device.readOnly && 'readonly',
    COOL_TYPES.has(device.type) && 'cool',
    pressing && 'pressing',
    dragging && 'dragging',
  ]
    .filter(Boolean)
    .join(' ');

  const lowBattery = device.battery !== null && device.battery <= LOW_BATTERY_PERCENT;

  return (
    <button
      className={className}
      data-id={device.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="tile-fill" style={{ height: `${clamp(fillLevel(device), 0, 100)}%` }} />
      <div className="tile-top">
        <div className="tile-icon">
          <DeviceIcon device={device} />
        </div>
        {lowBattery && (
          <div className="tile-badge">
            <BatteryLow size={14} aria-hidden="true" />
            {t('percent', { n: device.battery })}
          </div>
        )}
      </div>
      <div className="tile-text">
        <span className="tile-name">{label || device.name}</span>
        <span className="tile-status">{statusText(device)}</span>
      </div>
    </button>
  );
}
