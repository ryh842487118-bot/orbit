export const WALLPAPER_ZOOM_LIMITS = Object.freeze({ min: 5, max: 5000 });
export function clampWallpaperZoom(value) { return Math.min(WALLPAPER_ZOOM_LIMITS.max, Math.max(WALLPAPER_ZOOM_LIMITS.min, value)); }

export const WALLPAPER_DEFAULTS = Object.freeze({ mode: 'universe', selected: 'earth', center: 'middle',
  autoplay: false, interval: 15, zoom: 70, spaceColor: '#03070d', starsVisible: true, orbitsVisible: true, satellitesVisible: true,
  focusYaw: 0, focusPitch: 0, trajectoryCenter: 'middle',
  trajectoryDragYaw: 0, trajectoryDragPitch: 0,
  reference: 'galactic', trail: 'long' });
export function normalizeWallpaperSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const number = (key, min, max) => typeof value[key] !== 'boolean' && value[key] !== null && value[key] !== '' && Number.isFinite(Number(value[key]))
    ? Math.min(max, Math.max(min, Number(value[key]))) : WALLPAPER_DEFAULTS[key];
  return { mode: ['universe', 'focus', 'trajectory'].includes(value.mode) ? value.mode : value.single === true ? 'focus' : 'universe',
    selected: typeof value.selected === 'string' ? value.selected : 'earth',
    center: ['left', 'middle', 'right'].includes(value.center) ? value.center : 'middle',
    autoplay: typeof value.autoplay === 'boolean' ? value.autoplay : false,
    interval: number('interval', 5, 120), zoom: number('zoom', WALLPAPER_ZOOM_LIMITS.min, WALLPAPER_ZOOM_LIMITS.max),
    spaceColor: typeof value.spaceColor === 'string' && /^#[0-9a-f]{6}$/i.test(value.spaceColor) ? value.spaceColor.toLowerCase() : WALLPAPER_DEFAULTS.spaceColor,
    satellitesVisible: typeof value.satellitesVisible === 'boolean' ? value.satellitesVisible : true,
    starsVisible: typeof value.starsVisible === 'boolean' ? value.starsVisible : true,
    orbitsVisible: typeof value.orbitsVisible === 'boolean' ? value.orbitsVisible : true,
    focusYaw: number('focusYaw', -180, 180), focusPitch: number('focusPitch', -85, 85),
    trajectoryCenter: ['left','middle','right'].includes(value.trajectoryCenter) ? value.trajectoryCenter : 'middle',
    trajectoryDragYaw: number('trajectoryDragYaw', -180, 180), trajectoryDragPitch: number('trajectoryDragPitch', -85, 85),
    reference: value.reference === 'solar' ? 'solar' : 'galactic', trail: value.trail === 'short' ? 'short' : 'long' };
}
export function wallpaperFrame(width, height) {
  return { width, height };
}
export function nextWallpaperBody(ids, selected, direction) {
  if (!ids.length) return null;
  const index = Math.max(0, ids.indexOf(selected));
  return ids[((index + direction) % ids.length + ids.length) % ids.length];
}

export function nextTrajectoryPreset(reference, trail) {
  const presets=[['galactic','long'],['galactic','short'],['solar','long'],['solar','short']];
  const index=presets.findIndex(([r,t])=>r===reference && t===trail);
  const [nextReference,nextTrail]=presets[(index+1)%presets.length];
  return {reference:nextReference,trail:nextTrail};
}
