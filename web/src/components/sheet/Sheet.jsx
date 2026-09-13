import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useDevice } from '../../hooks/useStore.js';
import { characteristicLabel, formatValue } from '../../lib/device.js';
import { haptic } from '../../lib/haptics.js';
import { t } from '../../lib/i18n.js';
import { roomLabel } from '../../lib/rooms.js';
import { toggle } from '../../lib/store.js';
import { HSlider } from '../HSlider.jsx';
import { VSlider } from '../VSlider.jsx';
import { ChoiceRow } from './ChoiceRow.jsx';
import { OtherControls } from './OtherControls.jsx';
import { Thermostat } from './Thermostat.jsx';

const VERTICAL_SLIDERS = [
  ['Brightness', 'brightness'],
  ['RotationSpeed', 'speed'],
  ['TargetPosition', 'position'],
  ['Volume', 'volume'],
];
const TEMPERATURE_TARGETS = ['TargetTemperature', 'CoolingThresholdTemperature', 'HeatingThresholdTemperature'];

const CONTROLLED = new Set(['On', 'Active', 'Brightness', 'Hue', 'Saturation', 'ColorTemperature', 'RotationSpeed', 'TargetPosition', 'Volume']);

function onlyValid(device, char, options) {
  const valid = device.caps[char]?.validValues;
  return valid ? options.filter((option) => valid.includes(option.value)) : options;
}

function heatingModes(device) {
  const current = device.values.TargetHeatingCoolingState;
  const options = ['modeOff', 'modeHeat', 'modeCool', 'modeAuto'].map((key, value) => ({
    value,
    label: t(key),
    active: current === value,
  }));
  return onlyValid(device, 'TargetHeatingCoolingState', options);
}

function shortcutsFor(device) {
  const v = device.values;
  switch (device.type) {
    case 'lock':
      return {
        char: 'LockTargetState',
        options: [
          { value: 1, label: t('doLock'), active: v.LockCurrentState === 1 },
          { value: 0, label: t('doUnlock'), active: v.LockCurrentState === 0 },
        ],
      };
    case 'garage':
      return {
        char: 'TargetDoorState',
        options: [
          { value: 0, label: t('doOpen'), active: v.CurrentDoorState === 0 },
          { value: 1, label: t('doClose'), active: v.CurrentDoorState === 1 },
        ],
      };
    case 'security': {
      if (!device.caps.SecuritySystemTargetState?.write) return null;
      const options = ['secHome', 'secAway', 'secNight', 'secOff'].map((key, value) => ({
        value,
        label: t(key),
        active: v.SecuritySystemCurrentState === value,
      }));
      return { char: 'SecuritySystemTargetState', options: onlyValid(device, 'SecuritySystemTargetState', options) };
    }
    case 'cover':
      return {
        char: 'TargetPosition',
        options: [
          { value: 0, label: t('doClose') },
          { value: 50, label: t('doHalf') },
          { value: 100, label: t('doOpen') },
        ],
      };
    default:
      return null;
  }
}

export function Sheet({ id, onClose }) {
  const device = useDevice(id);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [id]);

  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!device) return null;

  const { caps, values, group } = device;
  const isGroupMain = group.primary && group.size > 1;
  const temperatureChar = TEMPERATURE_TARGETS.find((char) => caps[char]?.write);
  const shortcuts = shortcutsFor(device);
  const statusRows = Object.entries(values).filter(([key]) => !CONTROLLED.has(key));
  const subtitle = [roomLabel(device.room), device.humanType, isGroupMain && t('serviceCount', { n: group.size })];

  return (
    <>
      <div className={`backdrop${visible ? ' visible' : ''}`} onClick={onClose} />
      <section id="sheet" className={`sheet${visible ? ' visible' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <header className="sheet-head">
          <div>
            <div className="sheet-title">{isGroupMain ? group.name : device.name}</div>
            <div className="sheet-sub">{subtitle.filter(Boolean).join(' · ')}</div>
          </div>
          <button className="sheet-close" data-act="close" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {(device.primary === 'On' || device.primary === 'Active') && (
          <div className="sheet-section">
            <button
              className={`power-toggle${device.active ? ' on' : ''}`}
              data-act="power"
              onClick={() => {
                haptic();
                toggle(device);
              }}
            >
              {t(device.active ? 'on' : 'off')}
            </button>
          </div>
        )}

        {VERTICAL_SLIDERS.filter(([char]) => caps[char]?.write).map(([char, labelKey]) => (
          <VSlider key={char} device={device} char={char} label={t(labelKey)} />
        ))}

        {caps.ColorTemperature?.write && (
          <HSlider
            device={device}
            char="ColorTemperature"
            label={t('colorTemp')}
            min={caps.ColorTemperature.min ?? 140}
            max={caps.ColorTemperature.max ?? 500}
            invert
            className="gradient-ct"
          />
        )}
        {caps.Hue?.write && (
          <>
            <HSlider device={device} char="Hue" label={t('color')} min={0} max={360} className="gradient-hue" />
            {caps.Saturation?.write && (
              <HSlider device={device} char="Saturation" label={t('saturation')} min={0} max={100} showValue />
            )}
          </>
        )}

        {temperatureChar && <Thermostat device={device} char={temperatureChar} />}
        {caps.TargetHeatingCoolingState?.write && (
          <ChoiceRow
            device={device}
            char="TargetHeatingCoolingState"
            options={heatingModes(device)}
            label={t('mode')}
            act="mode"
          />
        )}
        {shortcuts && <ChoiceRow device={device} {...shortcuts} />}

        <OtherControls device={device} />

        {statusRows.length > 0 && (
          <div className="sheet-section">
            <div className="sheet-label">{t('statusSection')}</div>
            {statusRows.map(([key, value]) => (
              <div className="kv" key={key}>
                <span className="kv-key">{characteristicLabel(key)}</span>
                <span className="kv-val">{formatValue(key, value)}</span>
              </div>
            ))}
          </div>
        )}

        {(device.manufacturer || device.model) && (
          <div className="sheet-section">
            <div className="kv">
              <span className="kv-key">{t('deviceSection')}</span>
              <span>{[device.manufacturer, device.model].filter(Boolean).join(' · ')}</span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
