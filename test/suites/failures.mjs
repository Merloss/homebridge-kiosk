import { boot, sleep, reporter, FAKE_HB } from '../helpers.mjs';

const control = (cmd) => fetch(`${FAKE_HB}/__control`, { method: 'POST', body: JSON.stringify(cmd) }).then((r) => r.json());
await control({ drop: [], failSet: false, down: false, lagMs: 0 });

const { browser, page, errors, tile } = await boot('/');
const { check, section, summary } = reporter();

const tiles = () => page.locator('.tile').count();
const connText = async () => (await page.locator('#conn .conn-text').textContent()).trim();
const toastText = async () => ((await page.locator('#toast').count()) ? page.locator('#toast').textContent() : '');

section('A) A device disappears from Homebridge');
const before = await tiles();
await control({ drop: ['f-outlet'] });
await sleep(4000);
check('its card goes away', (await tiles()) === before - 1, `${before} -> ${await tiles()} cards`);
check('the other devices stay', (await tile('f-lamp').count()) === 1);

await control({ drop: [] });
await sleep(4000);
check('its card comes back with it', (await tiles()) === before, `${await tiles()} cards`);

section('B) A write fails (device not responding)');
await control({ failSet: true });
await sleep(300);
await tile('f-outlet').click();
await sleep(1500);
const toast = await toastText();
check('the user sees an error', /couldn'?t send/i.test(toast), `toast: "${toast}"`);

await sleep(3500);
const outletClass = await tile('f-outlet').getAttribute('class');
check('the optimistic value is rolled back', !/\bon\b/.test(outletClass), `class: ${outletClass}`);
await control({ failSet: false });

section('C) Homebridge becomes unreachable');
await control({ down: true });
await sleep(6000);
check('the connection shows Offline', (await connText()).includes('Offline'), `"${await connText()}"`);
const connClass = await page.locator('#conn').getAttribute('class');
check('with the offline style', connClass.includes('offline'), connClass);
check('the last known cards stay on screen', (await tiles()) > 0, `${await tiles()} cards`);

const bodyText = await page.locator('#root').textContent();
check('the REASON is shown, not just "Offline"', /can'?t reach|ECONNREFUSED|fetch failed|socket/i.test(bodyText));

await tile('f-lamp').click();
await sleep(2000);
const offlineToast = await toastText();
check('pressing a card while offline says so', !!offlineToast, offlineToast ? `toast: "${offlineToast}"` : 'silently swallowed');

section('D) Homebridge comes back');
await control({ down: false });
await sleep(7000);
check('the connection recovers on its own', !(await connText()).includes('Offline'), `"${await connText()}"`);
check('the cards are there', (await tiles()) > 0, `${await tiles()} cards`);

console.log(`\n  console errors (expected here): ${errors.length}`);

await browser.close();
process.exit(summary() ? 1 : 0);
