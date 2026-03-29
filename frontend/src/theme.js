export const THEME_STORAGE_KEY = 'cryguard-theme';

export function readDarkModeFromStorage() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'dark') return true;
    if (v === 'light') return false;
  } catch (_) {
    /* ignore */
  }
  return false;
}

export function writeDarkModeToStorage(dark) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
  } catch (_) {
    /* ignore */
  }
}

export function applyThemeToDocument(dark) {
  document.documentElement.classList.toggle('theme-dark', dark);
}
