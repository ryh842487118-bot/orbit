/** A clean canvas with a touch-friendly exit that does not obstruct screenshots. */
export function bindWallpaperMode(canvas) {
  const button = document.getElementById('wallpaper');
  const hiddenRoots = new Map();
  const pointers = new Set();
  let press = null, lastTap = null;
  const active = () => document.body.classList.contains('immersive');

  function setActive(value) {
    if (value === active()) return;
    document.body.classList.toggle('immersive', value);
    button.setAttribute('aria-pressed', String(value));
    lastTap = press = null;
    pointers.clear();
    if (value) {
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      for (const element of document.body.children) {
        if (['universe', 'error'].includes(element.id) || ['SCRIPT', 'STYLE'].includes(element.tagName)) continue;
        hiddenRoots.set(element, element.inert);
        element.inert = true;
      }
      document.getElementById('universe').focus({ preventScroll: true });
    } else {
      hiddenRoots.forEach((inert, element) => { element.inert = inert; });
      hiddenRoots.clear();
      button.focus({ preventScroll: true });
    }
  }

  button.setAttribute('aria-pressed', 'false');
  button.onclick = () => setActive(true);
  canvas.addEventListener('pointerdown', event => {
    if (!active()) return;
    pointers.add(event.pointerId);
    if (pointers.size > 1) { press = lastTap = null; return; }
    press = { x: event.clientX, y: event.clientY, time: performance.now() };
  });
  canvas.addEventListener('pointermove', event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press = lastTap = null;
  });
  canvas.addEventListener('pointerup', event => {
    if (!active()) return;
    // Also prevents this tap (including the restoring tap) from selecting a body.
    event.preventDefault();
    pointers.delete(event.pointerId);
    const now = performance.now();
    if (!press || pointers.size || now - press.time > 300) { press = lastTap = null; return; }
    const tap = { x: event.clientX, y: event.clientY, time: now };
    press = null;
    if (lastTap && now - lastTap.time < 350 && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 24) setActive(false);
    else lastTap = tap;
  });
  canvas.addEventListener('pointercancel', event => {
    pointers.delete(event.pointerId);
    press = lastTap = null;
  });
  return { toggle: () => setActive(!active()), exit: () => setActive(false) };
}
