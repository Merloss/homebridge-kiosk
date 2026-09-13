import { Minus, Plus } from 'lucide-react';
import { clamp, round } from '../../lib/device.js';
import { haptic } from '../../lib/haptics.js';
import { t } from '../../lib/i18n.js';
import { setChar } from '../../lib/store.js';

const DEFAULT_TARGET = 22;

export function Thermostat({ device, char }) {
  const { min = 10, max = 35, step } = device.caps[char];
  const target = device.values[char] ?? DEFAULT_TARGET;
  const current = device.values.CurrentTemperature;

  const nudge = (direction) => {
    haptic(8);
    const next = (device.values[char] ?? DEFAULT_TARGET) + direction * (step || 0.5);
    setChar(device, char, clamp(round(next, 1), min, max));
  };

  return (
    <div className="sheet-section">
      <div className="sheet-label">{t('targetTemp')}</div>
      <div className="thermo">
        <button className="thermo-btn" data-act="temp-down" aria-label="-" onClick={() => nudge(-1)}>
          <Minus size={26} />
        </button>
        <div>
          <div className="thermo-value">
            {round(target, 1)}
            <sup>°C</sup>
          </div>
          {typeof current === 'number' && <div className="thermo-current">{t('nowTemp', { t: round(current, 1) })}</div>}
        </div>
        <button className="thermo-btn" data-act="temp-up" aria-label="+" onClick={() => nudge(1)}>
          <Plus size={26} />
        </button>
      </div>
    </div>
  );
}
