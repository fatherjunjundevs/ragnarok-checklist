(() => {
  'use strict';
  try {
    const saved = JSON.parse(localStorage.getItem('rtnw-tracker-v5') || 'null');
    const pref = saved?.settings?.theme || 'system';
    const wantsDark = pref === 'dark' || (pref === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = wantsDark ? 'dark' : 'light';
  } catch (_) {
    document.documentElement.dataset.theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
})();
