const BRIDGE = { name: 'homebridge', username: '0E:11:22:33:44:55', ipAddress: '127.0.0.1', port: 51826 };

function characteristic(type, value, { format, min, max, step, unit, validValues, readOnly = false } = {}) {
  const inferred = typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'float' : 'string';
  return {
    type,
    value,
    format: format ?? inferred,
    canRead: true,
    canWrite: !readOnly,
    minValue: min,
    maxValue: max,
    minStep: step,
    unit,
    validValues,
  };
}

const ch = characteristic;
const reading = (type, value, options) => ch(type, value, { ...options, readOnly: true });
const percent = (type, value) => ch(type, value, { format: 'uint8', min: 0, max: 100, step: 1 });
const active = (value) => ch('Active', value, { format: 'uint8', min: 0, max: 1, step: 1 });

function createServices() {
  let nextAid = 100;

  const service = (uniqueId, name, humanType, characteristics, { aid, device, manufacturer, model } = {}) => ({
    aid: aid ?? nextAid++,
    instance: BRIDGE,
    uniqueId,
    serviceName: name,
    humanType,
    serviceCharacteristics: characteristics,
    accessoryInformation: {
      Name: device ?? name,
      Manufacturer: manufacturer ?? 'Mock',
      Model: model ?? humanType,
    },
  });

  const purifier = { aid: 20, device: 'Living Room Air Purifier' };

  return [
    service('mock-living-lamp', 'Living Room Lamp', 'Lightbulb', [
      ch('On', true),
      percent('Brightness', 72),
      ch('Hue', 38, { min: 0, max: 360, step: 1 }),
      ch('Saturation', 45, { min: 0, max: 100, step: 1 }),
      ch('ColorTemperature', 280, { format: 'int', min: 140, max: 500, step: 1 }),
    ], { manufacturer: 'TP-Link', model: 'Tapo L530E' }),
    service('mock-living-tv', 'Living Room TV', 'Television', [active(0)], { manufacturer: 'LG', model: 'OLED C2' }),
    service('mock-living-ac', 'Living Room AC', 'Heater Cooler', [
      active(1),
      reading('CurrentTemperature', 24.5),
      ch('CoolingThresholdTemperature', 22, { min: 16, max: 30, step: 0.5 }),
    ], { manufacturer: 'Mitsubishi', model: 'MSZ' }),
    service('mock-living-blinds', 'Living Room Blinds', 'Window Covering', [
      reading('CurrentPosition', 100, { format: 'uint8' }),
      percent('TargetPosition', 100),
    ]),
    service('mock-living-speaker', 'Living Room Speaker', 'Speaker', [
      active(1),
      ch('Mute', false),
      percent('Volume', 35),
    ], { manufacturer: 'Sonos', model: 'One' }),

    service('mock-purifier', 'Living Room Air Purifier', 'Air Purifier', [
      active(1),
      ch('RotationSpeed', 60, { min: 0, max: 100, step: 1 }),
      reading('CurrentAirPurifierState', 2, { format: 'uint8' }),
    ], { ...purifier, manufacturer: 'Xiaomi', model: 'Smart Air Purifier 4' }),
    service('mock-purifier-air', 'Air Quality', 'Air Quality Sensor', [
      reading('AirQuality', 2, { format: 'uint8' }),
      reading('PM2_5Density', 12),
    ], purifier),
    service('mock-purifier-buzzer', 'Buzzer', 'Switch', [ch('On', false)], purifier),
    service('mock-purifier-auto', 'Mode  Auto', 'Switch', [ch('On', true)], purifier),
    service('mock-purifier-sleep', 'Mode  Sleep', 'Switch', [ch('On', false)], purifier),
    service('mock-purifier-filter', 'Filter Maintenance', 'Filter Maintenance', [
      reading('FilterChangeIndication', 0, { format: 'uint8' }),
      reading('FilterLifeLevel', 78),
    ], purifier),

    service('mock-kitchen-spots', 'Kitchen Spots', 'Lightbulb', [
      ch('On', false),
      percent('Brightness', 100),
      ch('ColorTemperature', 200, { format: 'int', min: 140, max: 500, step: 1 }),
    ]),
    service('mock-coffee-maker', 'Coffee Maker', 'Outlet', [ch('On', false), reading('OutletInUse', false)]),
    service('mock-kitchen-temp', 'Kitchen Temperature', 'Temperature Sensor', [reading('CurrentTemperature', 23.1)]),
    service('mock-kitchen-leak', 'Under Sink Leak', 'Leak Sensor', [
      reading('LeakDetected', 0, { format: 'uint8' }),
      reading('BatteryLevel', 92, { format: 'uint8' }),
    ]),
    service('mock-kitchen-smoke', 'Kitchen Smoke Alarm', 'Smoke Sensor', [
      reading('SmokeDetected', 0, { format: 'uint8' }),
      reading('BatteryLevel', 78, { format: 'uint8' }),
    ]),

    service('mock-bedroom-lamp', 'Bedroom Lamp', 'Lightbulb', [
      ch('On', false),
      percent('Brightness', 30),
      ch('Hue', 12, { min: 0, max: 360, step: 1 }),
      ch('Saturation', 80, { min: 0, max: 100, step: 1 }),
    ]),
    service('mock-bedroom-thermostat', 'Bedroom Thermostat', 'Thermostat', [
      reading('CurrentTemperature', 21.4),
      ch('TargetTemperature', 22, { min: 10, max: 30, step: 0.5 }),
      ch('TargetHeatingCoolingState', 1, { format: 'uint8', min: 0, max: 3, step: 1, validValues: [0, 1, 2, 3] }),
      reading('CurrentRelativeHumidity', 44),
    ]),
    service('mock-ceiling-fan', 'Ceiling Fan', 'Fanv2', [
      active(0),
      ch('RotationSpeed', 40, { min: 0, max: 100, step: 10 }),
    ]),
    service('mock-bedroom-humidifier', 'Bedroom Humidifier', 'Humidifier Dehumidifier', [
      active(0),
      reading('CurrentRelativeHumidity', 38),
      ch('RelativeHumidityHumidifierThreshold', 45, { min: 0, max: 100, step: 1 }),
      ch('RotationSpeed', 50, { min: 0, max: 100, step: 1 }),
    ]),

    service('mock-front-door', 'Front Door', 'Lock Mechanism', [
      reading('LockCurrentState', 1, { format: 'uint8' }),
      ch('LockTargetState', 1, { format: 'uint8', min: 0, max: 1, step: 1 }),
    ]),
    service('mock-hallway-motion', 'Hallway Motion', 'Motion Sensor', [
      reading('MotionDetected', false),
      reading('BatteryLevel', 86),
    ]),
    service('mock-balcony-door', 'Balcony Door', 'Contact Sensor', [
      reading('ContactSensorState', 0, { format: 'uint8' }),
      reading('BatteryLevel', 61),
    ]),
    service('mock-home-alarm', 'Home Alarm', 'Security System', [
      reading('SecuritySystemCurrentState', 3, { format: 'uint8' }),
      ch('SecuritySystemTargetState', 3, { format: 'uint8', min: 0, max: 3, step: 1, validValues: [0, 1, 2, 3] }),
    ]),
    service('mock-hallway-button', 'Hallway Button', 'Stateless Programmable Switch', [
      reading('ProgrammableSwitchEvent', 0, { format: 'uint8' }),
    ]),

    service('mock-garage-door', 'Garage Door', 'Garage Door Opener', [
      reading('CurrentDoorState', 1, { format: 'uint8' }),
      ch('TargetDoorState', 1, { format: 'uint8', min: 0, max: 1, step: 1 }),
      reading('ObstructionDetected', false),
    ], { manufacturer: 'Meross', model: 'MSG100' }),
    service('mock-power-station', 'Power Station', 'Battery', [
      reading('BatteryLevel', 64, { format: 'uint8' }),
      reading('ChargingState', 1, { format: 'uint8' }),
      reading('StatusLowBattery', 0, { format: 'uint8' }),
    ]),

    service('mock-garden-irrigation', 'Garden Irrigation', 'Valve', [active(0), reading('InUse', 0, { format: 'uint8' })]),
    service('mock-garden-lights', 'Garden Lights', 'Lightbulb', [ch('On', false), percent('Brightness', 100)]),

    service('mock-bridge', 'Homebridge Mock ABCD', 'Protocol Information', [reading('Version', '1.1.0')], { aid: 1 }),
  ];
}

const room = (name, ...uniqueIds) => ({ name, services: uniqueIds.map((uniqueId) => ({ uniqueId })) });

const LAYOUT = [
  room('Living Room', 'mock-living-lamp', 'mock-living-tv', 'mock-living-ac', 'mock-living-blinds', 'mock-living-speaker',
    'mock-purifier', 'mock-purifier-air', 'mock-purifier-buzzer', 'mock-purifier-auto', 'mock-purifier-sleep', 'mock-purifier-filter'),
  room('Kitchen', 'mock-kitchen-spots', 'mock-coffee-maker', 'mock-kitchen-temp', 'mock-kitchen-leak', 'mock-kitchen-smoke'),
  room('Bedroom', 'mock-bedroom-lamp', 'mock-bedroom-thermostat', 'mock-ceiling-fan', 'mock-bedroom-humidifier'),
  room('Hallway', 'mock-front-door', 'mock-hallway-motion', 'mock-balcony-door', 'mock-home-alarm', 'mock-hallway-button'),
  room('Garage', 'mock-garage-door', 'mock-power-station'),
  room('Garden', 'mock-garden-irrigation', 'mock-garden-lights'),
];

const REACHES = {
  LockTargetState: 'LockCurrentState',
  TargetPosition: 'CurrentPosition',
  TargetDoorState: 'CurrentDoorState',
  SecuritySystemTargetState: 'SecuritySystemCurrentState',
  Active: 'InUse',
};

export class MockClient {
  #services = createServices();
  #tick = 0;

  async getAccessories() {
    this.#tick += 1;
    const drift = (base, amplitude) => Math.round((base + Math.sin(this.#tick / 20) * amplitude) * 10) / 10;
    this.#set('mock-kitchen-temp', 'CurrentTemperature', drift(23.1, 0.6));
    this.#set('mock-bedroom-thermostat', 'CurrentTemperature', drift(21.4, 0.4));
    this.#set('mock-living-ac', 'CurrentTemperature', drift(24.5, 0.5));
    if (this.#tick % 17 === 0) {
      this.#set('mock-hallway-motion', 'MotionDetected', !this.#find('mock-hallway-motion', 'MotionDetected').value);
    }

    return this.#services.map((service) =>
      structuredClone({
        ...service,
        values: Object.fromEntries(service.serviceCharacteristics.map((c) => [c.type, c.value])),
      })
    );
  }

  async getLayout() {
    return LAYOUT;
  }

  async setCharacteristic(uniqueId, type, value) {
    if (!this.#services.some((service) => service.uniqueId === uniqueId)) throw new Error('Device not found');
    this.#set(uniqueId, type, value);
    this.#set(uniqueId, REACHES[type], value);
    return { value };
  }

  #find(uniqueId, type) {
    const service = this.#services.find((s) => s.uniqueId === uniqueId);
    return service?.serviceCharacteristics.find((c) => c.type === type);
  }

  #set(uniqueId, type, value) {
    const target = this.#find(uniqueId, type);
    if (target) target.value = value;
  }
}
