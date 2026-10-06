/* Dispatch appearance only. Runs before CSS/body without inline scripts or requests. */
(() => {
  'use strict';
  const key = 'gridlyDispatchTheme';
  const valid = value => ['system', 'light', 'dark'].includes(value) ? value : 'system';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try { preference = valid(localStorage.getItem(key)); } catch { /* Storage may be unavailable. */ }

  function apply() {
    const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = preference; });
    // Future map adapters can consume this appearance-only event, without changing data.
    window.dispatchEvent(new CustomEvent('gridlydispatch:themechange', {detail: {preference, resolved}}));
  }
  function setPreference(value) {
    preference = valid(value);
    try { localStorage.setItem(key, preference); } catch { /* Keep the selection in memory. */ }
    apply();
  }
  window.gridlyDispatchTheme = Object.freeze({get preference() { return preference; }, setPreference});
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue);
      apply();
    }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-theme-select]')) setPreference(event.target.value);
  });
  apply();
})();
