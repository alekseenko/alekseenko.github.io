// Thin wrapper over Woopra (loaded in <head>) so nothing here can break the page
// if the script is blocked.

export function track(event, properties) {
  try {
    if (typeof window.woopra === 'undefined') return;
    window.woopra.track(event, properties);
  } catch (_) {
    /* analytics is never worth an exception */
  }
}
