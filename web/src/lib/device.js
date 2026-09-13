import { t } from './i18n.js';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const round = (value, digits = 0) => Math.round(value * 10 ** digits) / 10 ** digits;

const isNumber = (value) => typeof value === 'number';
const isRunning = (values) => values.Active === 1 || Boolean(values.On);

const LOCK_STATES = ['unlocked', 'locked', 'jammed', 'unknown'];
const DOOR_STATES = ['doorOpen', 'doorClosed', 'opening', 'closing', 'stopped'];
const HEATING_MODES = ['modeOff', 'modeHeat', 'modeCool', 'modeAuto'];
const SECURITY_STATES = ['armedHome', 'armedAway', 'armedNight', 'disarmed', 'alarmTriggered'];

const VALUE_LABELS = {
  LockCurrentState: LOCK_STATES,
  CurrentDoorState: DOOR_STATES,
  CurrentHeatingCoolingState: HEATING_MODES,
  TargetHeatingCoolingState: HEATING_MODES,
  SecuritySystemCurrentState: SECURITY_STATES,
  SecuritySystemTargetState: ['secHome', 'secAway', 'secNight', 'secOff'],
  CurrentAirPurifierState: ['purifierOff', 'purifierIdle', 'purifierPurifying'],
  TargetAirPurifierState: ['manual', 'auto'],
  CurrentFanState: ['fanOff', 'fanIdle', 'fanBlowing'],
  TargetFanState: ['manual', 'auto'],
  ContactSensorState: ['doorClosed', 'doorOpen'],
  FilterChangeIndication: ['good', 'mustReplace'],
  StatusLowBattery: ['no', 'yes'],
  SwingMode: ['off', 'on'],
  ChargingState: ['notCharging', 'charging', 'notChargeable'],
  ProgrammableSwitchEvent: ['pressSingle', 'pressDouble', 'pressLong'],
  AirQuality: ['aq0', 'aq1', 'aq2', 'aq3', 'aq4', 'aq5'],
};

export function isActive({ type, values: v }) {
  switch (type) {
    case 'light':
    case 'switch':
    case 'outlet':
      return Boolean(v.On);
    case 'fan':
    case 'purifier':
    case 'humidifier':
    case 'speaker':
    case 'tv':
    case 'valve':
      return isRunning(v);
    case 'heatercooler':
      return v.Active === 1;
    case 'lock':
      return v.LockCurrentState === 0;
    case 'garage':
      return v.CurrentDoorState !== 1;
    case 'cover':
      return (v.CurrentPosition ?? 0) > 0;
    default:
      return false;
  }
}

export function isAlert({ type, values: v }) {
  switch (type) {
    case 'leak':
      return v.LeakDetected === 1;
    case 'smoke':
      return v.SmokeDetected === 1;
    case 'lock':
      return v.LockCurrentState === 0;
    case 'security':
      return v.SecuritySystemCurrentState === 4;
    default:
      return false;
  }
}

const onWithLevel = (level) => (isNumber(level) ? t('onPercent', { n: Math.round(level) }) : t('on'));

function sensorStatus({ values: v, humanType }) {
  if (isNumber(v.FilterLifeLevel)) {
    return t(v.FilterChangeIndication === 1 ? 'filterChangeLife' : 'filterLife', { n: Math.round(v.FilterLifeLevel) });
  }
  if (isNumber(v.FilterChangeIndication)) return t(v.FilterChangeIndication === 1 ? 'filterChange' : 'filterOk');
  if (isNumber(v.CurrentTemperature)) return t('celsius', { n: round(v.CurrentTemperature, 1) });
  if (isNumber(v.CurrentRelativeHumidity)) return t('humidityValue', { n: Math.round(v.CurrentRelativeHumidity) });
  if (isNumber(v.CurrentAmbientLightLevel)) return t('luxValue', { n: Math.round(v.CurrentAmbientLightLevel) });
  if (isNumber(v.AirQuality)) return t(`aq${v.AirQuality}`);
  return humanType || t('dash');
}

export function statusText(device) {
  const v = device.values;
  switch (device.type) {
    case 'light':
      return v.On ? onWithLevel(v.Brightness) : t('off');
    case 'fan':
    case 'purifier':
    case 'humidifier':
      return isRunning(v) ? onWithLevel(v.RotationSpeed) : t('off');
    case 'speaker':
      if ('Active' in v && v.Active !== 1) return t('off');
      return v.Mute ? t('muted') : onWithLevel(v.Volume);
    case 'switch':
    case 'outlet':
      return t(v.On ? 'on' : 'off');
    case 'tv':
    case 'valve':
      return t(v.Active === 1 ? 'on' : 'off');
    case 'thermostat': {
      if (!isNumber(v.CurrentTemperature)) return t('dash');
      const cur = round(v.CurrentTemperature, 1);
      return isNumber(v.TargetTemperature) ? t('tempTarget', { cur, tgt: round(v.TargetTemperature, 1) }) : t('tempOnly', { cur });
    }
    case 'heatercooler': {
      const temperature = isNumber(v.CurrentTemperature) ? t('tempOnly', { cur: round(v.CurrentTemperature, 1) }) : t('dash');
      return t(v.Active === 1 ? 'onTemp' : 'offTemp', { t: temperature });
    }
    case 'lock':
      return t(LOCK_STATES[v.LockCurrentState] ?? 'unknown');
    case 'garage':
      return t(DOOR_STATES[v.CurrentDoorState] ?? 'dash');
    case 'security':
      return t(SECURITY_STATES[v.SecuritySystemCurrentState] ?? 'dash');
    case 'cover': {
      const position = v.CurrentPosition ?? v.TargetPosition;
      if (!isNumber(position)) return t('dash');
      if (position === 0) return t('doorClosed');
      if (position === 100) return t('doorOpen');
      return t('percentOpen', { n: Math.round(position) });
    }
    case 'contact':
      return t(v.ContactSensorState === 1 ? 'doorOpen' : 'doorClosed');
    case 'motion':
      return t(v.MotionDetected || v.OccupancyDetected === 1 ? 'motion' : 'calm');
    case 'leak':
      return t(v.LeakDetected === 1 ? 'leakAlert' : 'dry');
    case 'smoke':
      return t(v.SmokeDetected === 1 ? 'smokeAlert' : 'normal');
    case 'battery':
      return isNumber(v.BatteryLevel) ? t('percent', { n: Math.round(v.BatteryLevel) }) : t('dash');
    case 'button':
      return t('button');
    case 'bridge':
      return v.Version ? t('bridgeVersion', { v: v.Version }) : t('bridge');
    case 'sensor':
      return sensorStatus(device);
    default:
      if ('On' in v) return t(v.On ? 'on' : 'off');
      if ('Active' in v) return t(v.Active === 1 ? 'on' : 'off');
      return device.humanType;
  }
}

export function fillLevel(device) {
  const v = device.values;
  switch (device.type) {
    case 'light':
      return v.On ? (v.Brightness ?? 100) : 0;
    case 'fan':
    case 'purifier':
    case 'humidifier':
      return isRunning(v) ? (v.RotationSpeed ?? 100) : 0;
    case 'cover':
      return v.CurrentPosition ?? (device.active ? 100 : 0);
    default:
      return device.active ? 100 : 0;
  }
}

const DRAGGABLE = { light: 'Brightness', fan: 'RotationSpeed', purifier: 'RotationSpeed', humidifier: 'RotationSpeed', cover: 'TargetPosition' };

export function dragTarget(device) {
  const char = DRAGGABLE[device.type];
  const cap = device.caps[char];
  if (device.readOnly || !cap?.write) return null;
  return { char, min: 0, max: 100, step: (char === 'RotationSpeed' && cap.step) || 1 };
}

export function characteristicLabel(key) {
  const label = t(`lbl.${key}`);
  return label === `lbl.${key}` ? key.replace(/([a-z])([A-Z])/g, '$1 $2') : label;
}

export function formatValue(key, value) {
  if (typeof value === 'boolean') return t(value ? 'yes' : 'no');

  const labels = VALUE_LABELS[key];
  if (labels) return labels[value] ? t(labels[value]) : String(value);
  if (!isNumber(value)) return String(value);

  if (/Temperature/.test(key)) return t('celsius', { n: round(value, 1) });
  if (/Humidity|BatteryLevel|Position|Brightness|Speed|LifeLevel|Volume/.test(key)) return t('percent', { n: Math.round(value) });
  if (/LightLevel/.test(key)) return t('luxValue', { n: Math.round(value) });
  return String(round(value, 1));
}
