import {
  AirVent,
  AlarmSmoke,
  BatteryMedium,
  Blinds,
  Box,
  CircleDot,
  DoorClosed,
  DoorOpen,
  Droplet,
  Droplets,
  Fan,
  Gauge,
  Lightbulb,
  Lock,
  LockOpen,
  PersonStanding,
  Plug,
  Server,
  ShieldAlert,
  ShieldCheck,
  ShowerHead,
  Speaker,
  Sun,
  Thermometer,
  ToggleRight,
  Tv,
  Warehouse,
  Waves,
  Wind,
} from 'lucide-react';

const ICONS = {
  light: Lightbulb,
  switch: ToggleRight,
  outlet: Plug,
  fan: Fan,
  thermostat: Thermometer,
  heatercooler: AirVent,
  lock: Lock,
  garage: Warehouse,
  cover: Blinds,
  tv: Tv,
  speaker: Speaker,
  valve: ShowerHead,
  security: ShieldCheck,
  sensor: Gauge,
  contact: DoorClosed,
  motion: PersonStanding,
  leak: Droplets,
  smoke: AlarmSmoke,
  battery: BatteryMedium,
  purifier: Wind,
  humidifier: Waves,
  button: CircleDot,
  bridge: Server,
};

function iconFor({ type, values }) {
  if (type === 'lock' && values.LockCurrentState === 0) return LockOpen;
  if (type === 'contact' && values.ContactSensorState === 1) return DoorOpen;
  if (type === 'security' && values.SecuritySystemCurrentState === 4) return ShieldAlert;
  if (type === 'sensor') {
    if ('CurrentTemperature' in values) return Thermometer;
    if ('CurrentRelativeHumidity' in values) return Droplet;
    if ('CurrentAmbientLightLevel' in values) return Sun;
  }
  return ICONS[type] ?? Box;
}

export function DeviceIcon({ device, size = 20 }) {
  const Icon = iconFor(device);
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
