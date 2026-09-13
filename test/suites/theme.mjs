import { boot, sleep, reporter, startServer, PORTS } from '../helpers.mjs';

const { check, section, summary } = reporter();
const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);

function recordThemeAtBody() {
  new MutationObserver((_, observer) => {
    if (!document.body) return;
    window.__themeAtBody = document.documentElement.dataset.theme;
    observer.disconnect();
  }).observe(document, { childList: true, subtree: true });
}

section('auto (default)');
for (const scheme of ['dark', 'light']) {
  const { browser, page, errors } = await boot('/', { colorScheme: scheme, init: recordThemeAtBody });
  check(`a ${scheme} device gets the ${scheme} theme`, (await themeOf(page)) === scheme, await themeOf(page));
  const early = await page.evaluate(() => window.__themeAtBody);
  check(`${scheme}: already set before the first paint`, early === scheme, String(early));
  if (scheme === 'light') {
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    check('light: the light palette is applied', bg === '#eef1f6', bg);
    const meta = await page.locator('meta[name="theme-color"]').getAttribute('content');
    check('light: the browser theme-color follows', meta === '#eef1f6', meta);

    await page.emulateMedia({ colorScheme: 'dark' });
    await sleep(300);
    check('switching the device to dark follows live', (await themeOf(page)) === 'dark', await themeOf(page));
  }
  check(`${scheme}: no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
}

section('KIOSK_THEME=dark');
{
  const server = await startServer({ port: PORTS.spare, env: { HB_MOCK: '1', KIOSK_THEME: 'dark' } });
  const { browser, page } = await boot('/', { base: server.url, colorScheme: 'light' });
  await sleep(300);
  check('a light device still gets dark', (await themeOf(page)) === 'dark', await themeOf(page));
  await page.emulateMedia({ colorScheme: 'light' });
  await sleep(300);
  check('and a device theme change does not undo the pin', (await themeOf(page)) === 'dark', await themeOf(page));
  await browser.close();
  await server.stop();
}

process.exit(summary() ? 1 : 0);
