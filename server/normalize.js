import { UNASSIGNED_ROOM } from '../shared/constants.js';

const TYPES = {
  Lightbulb: 'light',
  Switch: 'switch',
  Outlet: 'outlet',
  Fan: 'fan',
  Fanv2: 'fan',
  Thermostat: 'thermostat',
  HeaterCooler: 'heatercooler',
  LockMechanism: 'lock',
  GarageDoorOpener: 'garage',
  Door: 'cover',
  Window: 'cover',
  WindowCovering: 'cover',
  Television: 'tv',
  SmartSpeaker: 'speaker',
  Speaker: 'speaker',
  Valve: 'valve',
  IrrigationSystem: 'valve',
  SecuritySystem: 'security',
  TemperatureSensor: 'sensor',
  HumiditySensor: 'sensor',
  LightSensor: 'sensor',
  AirQualitySensor: 'sensor',
  CarbonDioxideSensor: 'sensor',
  CarbonMonoxideSensor: 'sensor',
  FilterMaintenance: 'sensor',
  ContactSensor: 'contact',
  MotionSensor: 'motion',
  OccupancySensor: 'motion',
  LeakSensor: 'leak',
  SmokeSensor: 'smoke',
  StatelessProgrammableSwitch: 'button',
  Battery: 'battery',
  AirPurifier: 'purifier',
  HumidifierDehumidifier: 'humidifier',
  ProtocolInformation: 'bridge',
};

const READ_ONLY_TYPES = new Set(['sensor', 'contact', 'motion', 'leak', 'smoke', 'battery', 'button', 'bridge']);

const TOGGLES = {
  light: 'On',
  switch: 'On',
  outlet: 'On',
  valve: 'Active',
  tv: 'Active',
  purifier: 'Active',
  humidifier: 'Active',
  lock: 'LockTargetState',
  garage: 'TargetDoorState',
  cover: 'TargetPosition',
};

const TILE_PRIORITY = [
  'purifier', 'heatercooler', 'thermostat', 'humidifier', 'light', 'fan', 'cover', 'lock', 'garage', 'tv',
  'speaker', 'valve', 'outlet', 'switch', 'security', 'sensor', 'contact', 'motion', 'leak', 'smoke',
  'battery', 'button', 'other', 'bridge',
];

const tidy = (name) => String(name ?? '').replace(/\s+/g, ' ').trim();

function capabilities(characteristics = []) {
  return Object.fromEntries(
    characteristics
      .filter((c) => c?.type)
      .map((c) => [c.type, { write: Boolean(c.canWrite), min: c.minValue, max: c.maxValue, step: c.minStep, validValues: c.validValues }])
  );
}

function toggleFor(type, caps) {
  return [TOGGLES[type], 'On', 'Active'].find((char) => char && caps[char]?.write) ?? null;
}

function toDevice(accessory, placement = {}) {
  const humanType = accessory.humanType || accessory.type || 'Other';
  const type = TYPES[humanType.replace(/[^a-z0-9]/gi, '')] ?? 'other';
  const info = accessory.accessoryInformation ?? {};
  const caps = capabilities(accessory.serviceCharacteristics);
  const values = { ...accessory.values };
  const readOnly = READ_ONLY_TYPES.has(type);
  const bridge = accessory.instance?.username || accessory.instance?.name || '';

  return {
    id: accessory.uniqueId,
    name: tidy(placement.name || accessory.serviceName || info.Name || humanType),
    room: placement.room ?? UNASSIGNED_ROOM,
    type,
    humanType,
    manufacturer: info.Manufacturer ?? '',
    model: info.Model ?? '',
    caps,
    values,
    primary: readOnly ? null : toggleFor(type, caps),
    readOnly,
    battery: typeof values.BatteryLevel === 'number' ? Math.round(values.BatteryLevel) : null,
    isBridge: type === 'bridge',
    group: { id: `${bridge}:${accessory.aid ?? accessory.uniqueId}`, name: tidy(info.Name), primary: true, size: 1 },
  };
}

function groupByPhysicalDevice(devices) {
  const groups = new Map();
  for (const device of devices) {
    if (device.isBridge) continue;
    if (!groups.has(device.group.id)) groups.set(device.group.id, []);
    groups.get(device.group.id).push(device);
  }

  const rank = (device) => TILE_PRIORITY.indexOf(device.type);
  for (const [id, members] of groups) {
    const main = members.reduce((best, device) => (rank(device) < rank(best) ? device : best));
    const name = main.group.name || main.name;
    for (const device of members) {
      device.group = { id, name, primary: device === main, size: members.length };
    }
  }
}

export function normalizeAll(accessories = [], layout = []) {
  const placements = new Map();
  for (const room of layout) {
    for (const service of room?.services ?? []) {
      if (room.name && service?.uniqueId) {
        placements.set(service.uniqueId, { room: room.name, name: service.customName });
      }
    }
  }

  const devices = accessories.filter((a) => a?.uniqueId).map((a) => toDevice(a, placements.get(a.uniqueId)));
  groupByPhysicalDevice(devices);

  const roomNames = new Set([...layout.map((room) => room?.name), ...devices.map((device) => device.room)]);
  const rooms = [...roomNames].filter((name) => devices.some((device) => device.room === name));

  return { devices, rooms };
}
