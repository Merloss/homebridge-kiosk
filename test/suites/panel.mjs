import { boot, sleep, srv, api, getState, reporter } from '../helpers.mjs';

const { browser, page, errors, tile, boxOf, fill, dragTile, openSheet, closeSheet, dragVSlider } = await boot('/');
const { check, section, summary } = reporter();

const LAMP = 'mock-living-lamp';
const status = async (id) => (await tile(id).locator('.tile-status').textContent()).trim();

section('1) Dragging a card');
await api(LAMP, 'On', true);
await api(LAMP, 'Brightness', 30);
await sleep(1400);

const { samples, atRelease } = await dragTile(LAMP, { from: 0.9, to: 0.15, steps: 35 });
let jumps = 0;
for (let i = 1; i < samples.length; i++) if (samples[i] < samples[i - 1] - 0.5) jumps++;
check('the fill never jumps back during a drag', jumps === 0, `${jumps} jumps`);
check('the fill follows the finger', atRelease > 30, `30% -> ${atRelease}%`);

const box = await boxOf(LAMP);
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9 - i * 8);
}
await sleep(400);
check('the drag ends when the finger lifts', Math.abs((await fill(LAMP)) - atRelease) <= 1,
  `${atRelease}% at release, ${await fill(LAMP)}% after moving`);

section('2) Release and server confirmation');
await sleep(1800);
const s2 = await srv(LAMP);
check('the server received the final value', Math.abs(s2.values.Brightness - atRelease) <= 1,
  `card ${atRelease}%, server ${s2.values.Brightness}%`);
check('the card matches the server', Math.abs((await fill(LAMP)) - s2.values.Brightness) <= 1);

await api(LAMP, 'Brightness', 25);
await sleep(2400);
check('the card follows a value changed elsewhere', Math.abs((await fill(LAMP)) - 25) <= 1, `card ${await fill(LAMP)}%`);

section('3) Device sheet');
await openSheet(LAMP);
check('the sheet opens', (await page.locator('#sheet .vslider').count()) > 0);

await api(LAMP, 'Brightness', 70);
await sleep(1800);
const shown = await page.$eval('#sheet .vslider-fill', (el) => parseFloat(el.style.height));
check('the sheet shows a value changed elsewhere', Math.abs(shown - 70) <= 1, `sheet ${shown}%`);

await dragVSlider({ from: 0.8, to: 0.3 });
await sleep(1800);
const s3 = await srv(LAMP);
const sheetValue = await page.$eval('#sheet .vslider-value', (el) => parseFloat(el.textContent));
check('the sheet slider writes to the server', Math.abs(s3.values.Brightness - sheetValue) <= 1,
  `sheet ${sheetValue}%, server ${s3.values.Brightness}%`);

await sleep(4500);
await dragVSlider({ from: 0.9, to: 0.5 });
await sleep(1800);
const s4 = await srv(LAMP);
const sheetValue2 = await page.$eval('#sheet .vslider-value', (el) => parseFloat(el.textContent));
check('the slider still works after 4.5s of incoming patches', Math.abs(s4.values.Brightness - sheetValue2) <= 1,
  `sheet ${sheetValue2}%, server ${s4.values.Brightness}%`);

section('4) Sheet power button');
await api(LAMP, 'On', false);
await sleep(1600);
await page.locator('#sheet [data-act="power"]').click();
await sleep(1600);
check('the first press turns the lamp on', (await srv(LAMP)).values.On === true);
await closeSheet();

section('5) Touch drag (real touch events)');
const GARDEN = 'mock-garden-lights';
await api(GARDEN, 'On', false);
await api(GARDEN, 'Brightness', 80);
await sleep(1400);
const tb = await boxOf(GARDEN);
const cdp = await page.context().newCDPSession(page);
const x = tb.x + tb.width / 2;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: tb.y + tb.height * 0.2 }] });
for (let i = 1; i <= 10; i++) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: tb.y + tb.height * (0.2 + i * 0.06) }] });
  await sleep(20);
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(1800);
const s5 = await srv(GARDEN);
check('a touch drag writes to the server', s5.values.Brightness !== 80, `Brightness=${s5.values.Brightness}`);
check('the matching On is written too', s5.values.On === true, `On=${s5.values.On}`);

section('6) Regressions');
await api('mock-coffee-maker', 'On', false);
await sleep(1400);
await tile('mock-coffee-maker').click();
await sleep(1600);
check('tapping a card turns the device on', (await srv('mock-coffee-maker')).values.On === true);

await page.locator('.room-tab', { hasText: 'Living Room' }).click();
await sleep(500);
const expected = (await getState()).devices.filter(
  (d) => d.room === 'Living Room' && !d.isBridge && d.group?.primary !== false
).length;
const cards = await page.locator('.tile').count();
check('the room tab filters the cards', cards === expected, `${cards} cards, expected ${expected}`);
await page.locator('.room-tab').first().click();
await sleep(500);

await openSheet('mock-bedroom-thermostat');
const before = (await srv('mock-bedroom-thermostat')).values.TargetTemperature;
await page.locator('#sheet [data-act="temp-up"]').click();
await sleep(1800);
const after = (await srv('mock-bedroom-thermostat')).values.TargetTemperature;
check('thermostat + raises the target', after > before, `${before} -> ${after}`);
await closeSheet();

section('7) Alarm and garage door');
await api('mock-home-alarm', 'SecuritySystemTargetState', 3);
await sleep(1400);
await openSheet('mock-home-alarm');
const modes = page.locator('#sheet [data-char="SecuritySystemTargetState"]');
check('the alarm sheet offers four modes', (await modes.count()) === 4, `${await modes.count()} buttons`);
await modes.and(page.locator('[data-value="1"]')).click();
await sleep(1600);
const alarm = (await srv('mock-home-alarm')).values;
check('arming "away" reaches the server', alarm.SecuritySystemTargetState === 1 && alarm.SecuritySystemCurrentState === 1,
  `target ${alarm.SecuritySystemTargetState}, current ${alarm.SecuritySystemCurrentState}`);
await closeSheet();
check('the alarm tile shows the armed state', (await status('mock-home-alarm')) === 'Armed · away', await status('mock-home-alarm'));
await api('mock-home-alarm', 'SecuritySystemTargetState', 3);

await api('mock-garage-door', 'TargetDoorState', 1);
await sleep(1400);
await openSheet('mock-garage-door');
await page.locator('#sheet [data-char="TargetDoorState"][data-value="0"]').click();
await sleep(1600);
check('opening the garage door reaches the server', (await srv('mock-garage-door')).values.CurrentDoorState === 0);
await closeSheet();
check('the garage tile says Open', (await status('mock-garage-door')) === 'Open', await status('mock-garage-door'));
await api('mock-garage-door', 'TargetDoorState', 1);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
process.exit(summary() ? 1 : 0);
