import { boot, sleep, srv, api, getState, reporter, BASE } from '../helpers.mjs';

const { browser, page, errors, tile, openSheet, closeSheet } = await boot('/');
const { check, section, summary } = reporter();

const state = await getState();
const nonBridge = state.devices.filter((d) => !d.isBridge);
const primaries = nonBridge.filter((d) => d.group.primary);
const purifier = state.devices.find((d) => d.id === 'mock-purifier');

section('Server side');
console.log(`  ${state.devices.length} services, ${primaries.length} devices, ${state.devices.length - nonBridge.length} bridge`);

const TYPES = [
  'light', 'switch', 'outlet', 'fan', 'thermostat', 'heatercooler', 'lock', 'garage', 'cover',
  'tv', 'speaker', 'valve', 'security', 'sensor', 'contact', 'motion', 'leak', 'smoke', 'button',
  'battery', 'purifier', 'humidifier', 'bridge',
];
const missing = TYPES.filter((type) => !state.devices.some((d) => d.type === type));
check('the mock has a device of every type', missing.length === 0, missing.join(', ') || `${TYPES.length} types`);

const other = state.devices.filter((d) => d.type === 'other');
check('no service falls through to "other"', other.length === 0, other.map((d) => d.humanType).join(', ') || 'none');
check('"Air Purifier" (with a space) is typed correctly', purifier?.type === 'purifier', purifier?.type);
check('the bridge is marked', state.devices.some((d) => d.isBridge));
check('double spaces in names are collapsed', state.devices.some((d) => d.name === 'Mode Auto'),
  state.devices.find((d) => d.id === 'mock-purifier-auto')?.name);
check('the purifier is the main service of its group', purifier?.group.primary === true);
check('the group has 6 services', purifier?.group.size === 6, String(purifier?.group.size));
check('the buzzer is not a main service', state.devices.find((d) => d.id === 'mock-purifier-buzzer')?.group.primary === false);

section('View switch');
const toggles = await page.locator('.viewtoggle-btn').count();
check('the switch is there', toggles === 2, `${toggles} buttons`);
check('the debug tab is hidden', (await page.locator('[data-view="debug"]').count()) === 0);
check('grouped is the default', (await page.locator('[data-view="grouped"].active').count()) === 1);

const groupedCount = await page.locator('.tile').count();
check('grouped: one card per device', groupedCount === primaries.length, `${groupedCount} cards, ${primaries.length} devices`);
check('grouped: the card shows the DEVICE name',
  (await tile('mock-purifier').locator('.tile-name').textContent()) === 'Living Room Air Purifier');
check('grouped: no buzzer card', (await tile('mock-purifier-buzzer').count()) === 0);
check('grouped: no bridge card', (await tile('mock-bridge').count()) === 0);

await page.locator('[data-view="all"]').click();
await sleep(400);
const allCount = await page.locator('.tile').count();
check('all: one card per service', allCount === nonBridge.length, `${allCount} cards, ${nonBridge.length} services`);
check('all: the buzzer card is there', (await tile('mock-purifier-buzzer').count()) === 1);
check('all: the bridge is still hidden', (await tile('mock-bridge').count()) === 0);
check('all: the card shows the SERVICE name',
  (await tile('mock-purifier').locator('.tile-name').textContent()) === 'Living Room Air Purifier');

await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.tile');
await sleep(600);
check('the choice survives a reload', (await page.locator('[data-view="all"].active').count()) === 1);

await page.locator('[data-view="grouped"]').click();
await sleep(400);

section('Sheet: other controls');
await openSheet('mock-purifier');
check('the sheet title is the device name', (await page.locator('#sheet .sheet-title').textContent()) === 'Living Room Air Purifier');
const rows = await page.locator('#sheet .subrow').count();
check('5 sub-controls are listed', rows === 5, `${rows} rows`);
const switches = await page.locator('#sheet .subrow-switch').count();
check('writable ones are switches', switches === 3, `${switches} switches`);
check('read-only ones show a value', (await page.locator('#sheet .subrow-val').count()) === 2);
check('the purifier speed slider is there', (await page.locator('#sheet .vslider').count()) === 1);

const buzzer = '#sheet [data-sub-id="mock-purifier-buzzer"] .subrow-switch';
const was = (await srv('mock-purifier-buzzer')).values.On;
await page.locator(buzzer).click();
await sleep(1600);
const now = (await srv('mock-purifier-buzzer')).values.On;
check('a sub-control writes to the RIGHT service', now === !was, `On: ${was} -> ${now}`);
check('the main service is untouched', (await srv('mock-purifier')).values.Active === 1);
check('the switch updates visually', (await page.locator(buzzer).getAttribute('class')).includes('on') === now);

await api('mock-purifier-auto', 'On', false);
await sleep(1800);
check('a change made elsewhere reaches the sub-row',
  !(await page.locator('#sheet [data-sub-id="mock-purifier-auto"] .subrow-switch').getAttribute('class')).includes('on'));

await closeSheet();
await openSheet('mock-living-lamp');
check('a single-service device has no "Other controls"', (await page.locator('#sheet .subrow').count()) === 0);
await closeSheet();

section('?debug=1');
await page.goto(`${BASE}/?debug=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('.tile');
await sleep(600);
check('the debug tab appears', (await page.locator('[data-view="debug"]').count()) === 1);
await page.goto(`${BASE}/?debug=0`, { waitUntil: 'networkidle' });
await page.waitForSelector('.tile');
await sleep(600);
check('?debug=0 hides it again', (await page.locator('[data-view="debug"]').count()) === 0);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
process.exit(summary() ? 1 : 0);
