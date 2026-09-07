/** Preserve the universe view while EarthSense borrows its existing camera. */
export function createEarthSession(navigation, ui) {
  let saved, active = false;
  return {
    get active() { return active; },
    enter() {
      if (active) return;
      saved = { navigation: navigation.snapshot(), settings: ui.getState() };
      active = true;
      navigation.flyTo('earth');
    },
    leave() {
      if (!active) return;
      active = false;
      ui.restoreState(saved.settings);
      navigation.restore(saved.navigation);
      saved = null;
    },
  };
}
