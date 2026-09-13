import { boot, sleep, reporter, api, FAKE_HB } from '../helpers.mjs';

const control = (cmd) =>
  fetch(`${FAKE_HB}/__control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  }).then((r) => r.json());

const LAMP = 'f-lamp';

const { browser, page, errors, tile, boxOf } = await boot('/');
const { check, section, summary } = reporter();
const isOn = () => tile(LAMP).evaluate((el) => el.classList.contains('on'));

await control({ lagMs: 1200, down: false, failSet: false, drop: [] });
await api(LAMP, 'On', false);
await sleep(3000);
check('starting point: the lamp is off', (await isOn()) === false);

section('Tap the card, sample every 40ms for 4s');
const box = await boxOf(LAMP);
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

const samples = [];
const t0 = Date.now();
while (Date.now() - t0 < 4000) {
  samples.push({ t: Date.now() - t0, on: await isOn() });
  await sleep(40);
}

const flips = [];
for (let i = 1; i < samples.length; i++) {
  if (samples[i].on !== samples[i - 1].on) flips.push(`${samples[i].on ? 'ON' : 'OFF'}@${samples[i].t}ms`);
}
console.log(`  transitions: ${flips.join(' ') || 'none'}`);

const firstOn = samples.findIndex((s) => s.on);
const offAfterOn = firstOn === -1 ? [] : samples.slice(firstOn).filter((s) => !s.on);
check('never OFF again once ON', offAfterOn.length === 0,
  offAfterOn.length ? `${offAfterOn.length} OFF samples, first at ${offAfterOn[0].t}ms` : 'no flicker');
check('turns on right away', firstOn !== -1 && firstOn <= 2, `first ON sample #${firstOn}`);
check('stays on', samples.at(-1).on === true);
check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await control({ lagMs: 0 });
await browser.close();
process.exit(summary() ? 1 : 0);
