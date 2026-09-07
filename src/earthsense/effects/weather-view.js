import * as THREE from 'three';
import { createMarkerLayer } from '../markers.js';
import { appearancesFor } from './weather-state.js';
import { createStormClouds } from './storm-clouds.js';
import { createRain } from './rain.js';
import { createLightningBolts } from './lightning-bolts.js';

export function createWeatherView({ simulatedStorm = false, colorFor } = {}) {
  const group = new THREE.Group();
  group.name = simulatedStorm ? 'Simulated lightning weather' : 'Observed weather illustrations';
  const anchor = createMarkerLayer({ color: simulatedStorm ? '#f3e7a1' : '#ffffff', colorFor, segments: 6, size: () => .7 });
  anchor.group.visible = false;
  const clouds = createStormClouds(), rain = createRain(), bolts = createLightningBolts();
  const parts = [anchor, clouds, rain, bolts];
  group.add(...parts.map(part => part.group));

  return {
    group,
    setEvents(events) {
      const appearances = appearancesFor(events, simulatedStorm);
      anchor.setEvents(appearances.map(item => item.event));
      for (const effect of [clouds, rain, bolts]) effect.setEvents(appearances);
      group.userData.locations = appearances.length;
      group.userData.thunderstorms = appearances.filter(item => item.thunder).length;
      group.userData.weatherEffects = appearances.map(({ event, rainRate, rainIntensity, puffs, drops, flashPeriod, flashIntensity }) =>
        ({ id: event.id, rainRate, rainIntensity, puffs, drops, flashPeriod, flashIntensity }));
    },
    update(time, options) { for (const part of parts) part.update(time, options); },
    diagnostics: () => ({ effects: (group.userData.weatherEffects || []).map(effect => ({ ...effect })) }),
    pick(raycaster, surfaceDistance = Infinity) {
      if (!group.visible) return null;
      return [anchor.pick(raycaster, surfaceDistance), clouds.pick(raycaster, surfaceDistance)]
        .filter(Boolean).sort((a, b) => a.distance - b.distance)[0] || null;
    },
    dispose() { for (const part of parts) part.dispose(); group.removeFromParent(); },
  };
}
