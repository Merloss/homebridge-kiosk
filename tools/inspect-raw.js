import { config } from '../server/config.js';
import { HomebridgeClient } from '../server/homebridge.js';
import { normalizeAll } from '../server/normalize.js';

const client = new HomebridgeClient(config.homebridge);
const accessories = await client.getAccessories();

if (process.argv.includes('--raw')) {
  for (const a of accessories) {
    const aid = String(a.aid ?? '-').padStart(3);
    console.log(`aid:${aid}  ${String(a.humanType).padEnd(22)} ${String(a.serviceName ?? '').padEnd(32)} device:${a.accessoryInformation?.Name ?? ''}`);
  }
  process.exit(0);
}

const { devices, rooms } = normalizeAll(accessories, await client.getLayout());
const groups = new Map();
for (const device of devices) {
  if (device.isBridge) {
    console.log(`BRIDGE  ${device.name}`);
    continue;
  }
  if (!groups.has(device.group.id)) groups.set(device.group.id, []);
  groups.get(device.group.id).push(device);
}

for (const members of groups.values()) {
  console.log(`\nDEVICE "${members[0].group.name}" (${members.length} services)`);
  for (const m of members) {
    const role = m.readOnly ? '[read-only]' : `toggles ${m.primary}`;
    console.log(`  ${m.group.primary ? '*' : ' '} ${m.type.padEnd(13)} ${m.name.padEnd(26)} ${role}`);
  }
}

const other = devices.filter((d) => d.type === 'other').map((d) => d.humanType);
console.log(`\n${devices.length} services, ${groups.size} devices, rooms: ${rooms.join(', ')}`);
console.log(`unrecognized types: ${other.join(', ') || 'none'}`);
