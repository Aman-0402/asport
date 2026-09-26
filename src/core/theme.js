const STORAGE_KEY = 'astha-theme';
const listeners = new Set();

export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Subscribe to theme changes (used by 3D scenes to swap palettes). */
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyTheme(theme, toggle) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f8f3ee' : '#1b1614';
  if (toggle) {
    toggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  }
  listeners.forEach((fn) => fn(theme));
}

export function initTheme() {
  const toggle = document.querySelector('[data-theme-toggle]');
  applyTheme(getTheme(), toggle);
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const next = getTheme() === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked: theme still applies for this page view */
    }
    applyTheme(next, toggle);
  });
}
