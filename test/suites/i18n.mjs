import { boot, sleep, api, reporter, BASE } from '../helpers.mjs';
import { t, setLang } from '../../web/src/lib/i18n.js';

const inLang = (lang) => (key, vars) => {
  setLang(lang);
  return t(key, vars);
};
const EN = inLang('en');
const TR = inLang('tr');

const { browser, page, errors, tile, openSheet, closeSheet } = await boot('/', { locale: 'en-US' });
const { check, section, summary } = reporter();

const text = async (locator) => (await locator.textContent()).trim();
const viewButton = () => text(page.locator('[data-view="grouped"]'));
const lampStatus = () => text(tile('mock-living-lamp').locator('.tile-status'));

section('Default: an en-US browser gets English');
check('the UI is English', (await viewButton()) === EN('viewGrouped'), await viewButton());
check('the connection label is English', (await text(page.locator('#conn .conn-text'))) === EN('demo'));
check('the language switch is there', (await page.locator('.langtoggle-btn').count()) === 2);
check('EN is selected', (await page.locator('[data-lang="en"].active').count()) === 1);

await api('mock-living-lamp', 'On', true);
await api('mock-living-lamp', 'Brightness', 40);
await sleep(1500);
check('tile status is English', (await lampStatus()) === EN('onPercent', { n: 40 }), await lampStatus());

section('Press TR');
await page.locator('[data-lang="tr"]').click();
await sleep(600);
check('the view switch is Turkish', (await viewButton()) === TR('viewGrouped'), await viewButton());
check('the room tab is Turkish', (await text(page.locator('.room-tab').first())) === TR('allRooms'));
check('tile status text is Turkish too', (await lampStatus()) === TR('onPercent', { n: 40 }), await lampStatus());

await openSheet('mock-purifier');
const labels = await page.locator('#sheet .sheet-label').allTextContents();
check('sheet labels are Turkish', labels.includes(TR('otherControls')), labels.join(' | '));
check('the service count is Turkish',
  (await text(page.locator('#sheet .sheet-sub'))).includes(TR('serviceCount', { n: 6 })));
const keys = await page.locator('#sheet .kv-key').allTextContents();
check('characteristic labels are translated', keys.includes(TR('lbl.CurrentAirPurifierState')), keys.join(' | '));
await closeSheet();

section('Persistence');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.tile');
await sleep(700);
check('the choice survives a reload', (await viewButton()) === TR('viewGrouped'), await viewButton());

await page.goto(`${BASE}/?lang=en`, { waitUntil: 'networkidle' });
await page.waitForSelector('.tile');
await sleep(700);
check('?lang=en works', (await viewButton()) === EN('viewGrouped'), await viewButton());

section('Untranslated keys');
const SHEETS = [
  'mock-purifier', 'mock-living-lamp', 'mock-bedroom-thermostat', 'mock-front-door', 'mock-living-blinds',
  'mock-home-alarm', 'mock-living-speaker', 'mock-garage-door', 'mock-power-station', 'mock-hallway-button',
  'mock-bedroom-humidifier',
];
for (const lang of ['en', 'tr']) {
  await page.goto(`${BASE}/?lang=${lang}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.tile');
  await sleep(600);
  const leaked = new Set();
  for (const id of SHEETS) {
    await openSheet(id);
    for (const m of (await page.locator('#app, #root').first().textContent()).match(/lbl\.[A-Za-z0-9_]+/g) || []) {
      leaked.add(m);
    }
    await closeSheet();
  }
  check(`${lang}: no label keys leak into the UI`, leaked.size === 0, [...leaked].join(', ') || `${SHEETS.length} sheets clean`);
}

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();

section('A tr-TR browser gets Turkish');
{
  const turkish = await boot('/', { locale: 'tr-TR' });
  const button = await text(turkish.page.locator('[data-view="grouped"]'));
  check('the UI opens in Turkish', button === TR('viewGrouped'), button);
  check('TR is selected', (await turkish.page.locator('[data-lang="tr"].active').count()) === 1);
  await turkish.browser.close();
}

process.exit(summary() ? 1 : 0);
