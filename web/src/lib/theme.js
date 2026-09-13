const THEME_COLORS = { dark: '#0b0d12', light: '#eef1f6' };
const prefersLight = matchMedia('(prefers-color-scheme: light)');

let preference = 'auto';

function paint() {
  const theme = preference === 'auto' ? (prefersLight.matches ? 'light' : 'dark') : preference;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

prefersLight.addEventListener('change', () => {
  if (preference === 'auto') paint();
});

export function applyTheme(theme) {
  preference = theme === 'dark' || theme === 'light' ? theme : 'auto';
  paint();
}
