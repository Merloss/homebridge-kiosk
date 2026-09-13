import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { dragTarget } from '../lib/device.js';
import { t } from '../lib/i18n.js';

const SLIDERS = [
  ['Brightness', 'VSlider', 'brightness'],
  ['RotationSpeed', 'VSlider', 'speed'],
  ['TargetPosition', 'VSlider', 'position'],
  ['Volume', 'VSlider', 'volume'],
  ['ColorTemperature', 'HSlider', 'colorTemp'],
  ['Hue', 'HSlider', 'color'],
  ['Saturation', 'HSlider', 'saturation'],
];

const TYPE_COMPONENTS = { lock: 'compLock', garage: 'compGarage', security: 'compSecurity', cover: 'compCoverShortcut' };

function componentsOf(device) {
  const writable = (char) => device.caps[char]?.write;
  const found = [];

  if (device.primary === 'On' || device.primary === 'Active') found.push(t('compPower'));
  for (const [char, slider, labelKey] of SLIDERS) {
    if (writable(char)) found.push(`${slider}·${t(labelKey)}`);
  }
  if (['TargetTemperature', 'CoolingThresholdTemperature', 'HeatingThresholdTemperature'].some(writable)) {
    found.push(t('compThermostat'));
  }
  if (writable('TargetHeatingCoolingState')) found.push(t('mode'));
  if (TYPE_COMPONENTS[device.type]) found.push(t(TYPE_COMPONENTS[device.type]));
  if (dragTarget(device)) found.push(t('compDragCard'));
  if (device.readOnly) found.push(t('compReadOnly'));
  return found;
}

export function DevBar({ devices, openSheet, sheetId }) {
  const [open, setOpen] = useState(true);
  const covered = new Set(devices.flatMap(componentsOf));
  const Chevron = open ? ChevronDown : ChevronUp;

  return (
    <div className={`devbar${open ? ' open' : ''}`}>
      <button className="devbar-toggle" onClick={() => setOpen(!open)}>
        <Chevron size={14} aria-hidden="true" />
        {t('componentTest')} · {t('devbarSummary', { devices: devices.length, components: covered.size })}
      </button>

      {open && (
        <div className="devbar-body">
          <div className="devbar-note">{t('devbarNote')}</div>
          <div className="devbar-list">
            {devices.map((device) => {
              const components = componentsOf(device);
              return (
                <button
                  key={device.id}
                  className={`devbar-item${sheetId === device.id ? ' active' : ''}`}
                  onClick={() => openSheet(sheetId === device.id ? null : device.id)}
                >
                  <span className="devbar-item-name">{device.name}</span>
                  <span className="devbar-item-type">{device.type}</span>
                  <span className="devbar-item-comps">
                    {components.length ? components.join(' · ') : t('compTileOnly')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
