/**
 * Fantasy Music Player: opening screen.
 *
 * Loaded in <head> without `defer`, so `.is-loading` is set on <html> before the first paint
 * and the app never flashes. It also adds `.has-js`, which shows the playback controls. With
 * JavaScript disabled neither class is added: the home screen shows immediately and a short
 * message replaces the controls. CSS failsafes in page-loader.css reveal the app even if this
 * script fails.
 */

(() => {
  const LOADER_DURATION_MS = 1800;
  const root = document.documentElement;

  root.classList.add("has-js", "is-loading");

  window.setTimeout(() => {
    root.classList.remove("is-loading");
    root.classList.add("is-loaded");
  }, LOADER_DURATION_MS);
})();
