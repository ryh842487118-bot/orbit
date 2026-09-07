import * as THREE from 'three';
import { latLonToVector } from '../../earth/coordinates.js';

const thunderCodes = new Set([95, 96, 99]);
const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const snowCodes = new Set([71, 73, 75, 77, 85, 86]);
const clamp = THREE.MathUtils.clamp;

/** These are local visual footprints, not meteorological cloud boundaries. */
export const WEATHER_EFFECTS = Object.freeze({
  maxLocations: 60, cloudRadius: .075, stormRadius: .09,
  cloudAltitude: .012, stormAltitude: .020,
  maxWeatherPuffs: 11, stormPuffs: 14, maxRainDrops: 22,
  maxRainRate: 50, minFlashPeriod: 4, maxFlashPeriod: 18,
});

function rainfallAmount(weather) {
  const values = [weather.rain, weather.precipitation].filter(value => Number.isFinite(value) && value >= 0);
  return values.length ? Math.max(...values) : null;
}

/** Open-Meteo amounts are accumulated millimeters; interval is seconds, not hours. */
export function rainRatePerHour(weather = {}) {
  const amount = rainfallAmount(weather);
  return amount !== null && Number.isFinite(weather.interval) && weather.interval > 0
    ? amount * (3600 / weather.interval) : null;
}

export function weatherAppearance(event, simulatedStorm = false) {
  const weather = event.weather || {};
  const clear = weather.code === 0 || weather.code === 1;
  const thunder = !clear && thunderCodes.has(weather.code);
  const rainfall = rainfallAmount(weather), rainRate = rainRatePerHour(weather);
  const raining = !clear && !snowCodes.has(weather.code) && rainfall !== 0
    && (rainfall > 0 || rainCodes.has(weather.code));
  // Missing intervals allow a qualitative rain-code illustration, never an invented mm/h value.
  const rainIntensity = raining ? rainRate === null ? .12
    : clamp(Math.log1p(rainRate) / Math.log1p(WEATHER_EFFECTS.maxRainRate), 0, 1) : 0;
  const codeCloud = weather.code === 0 ? 0 : weather.code === 1 ? .22 : weather.code === 2 ? .55 : weather.code === 3 ? 1 : [45, 48].includes(weather.code) ? .65 : 0;
  const reportedCloud = Number.isFinite(weather.cloudCover) ? clamp(weather.cloudCover / 100, 0, 1) : codeCloud;
  const coverage = clear ? 0 : Math.max(reportedCloud, thunder ? 1 : raining ? .75 : 0);
  const density = coverage < .12 ? 0 : coverage;
  const radius = (thunder ? WEATHER_EFFECTS.stormRadius * (.72 + rainIntensity * .28)
    : WEATHER_EFFECTS.cloudRadius * (.65 + density * .35));
  return {
    event, thunder, raining, rainfall, rainRate, rainIntensity, coverage: density,
    rainSpeed: .55 + rainIntensity * 1.3,
    rainLength: .008 + rainIntensity * .019,
    rainSpread: radius * (.35 + rainIntensity * .45),
    flashPeriod: thunder ? THREE.MathUtils.lerp(WEATHER_EFFECTS.maxFlashPeriod, WEATHER_EFFECTS.minFlashPeriod, Math.sqrt(rainIntensity)) : null,
    flashIntensity: thunder ? .25 + rainIntensity * .75 : 0,
    darkness: thunder ? .9 : raining ? .65 : density > .8 ? .35 : .03,
    radius,
    altitude: thunder ? WEATHER_EFFECTS.stormAltitude : WEATHER_EFFECTS.cloudAltitude,
    puffs: density ? simulatedStorm ? WEATHER_EFFECTS.stormPuffs : Math.ceil(3 + density * (WEATHER_EFFECTS.maxWeatherPuffs - 3)) : 0,
    drops: raining ? Math.min(WEATHER_EFFECTS.maxRainDrops, Math.ceil(3 + rainIntensity * (WEATHER_EFFECTS.maxRainDrops - 3))) : 0,
  };
}

export function eventRandom(event, salt = 0) {
  const text = `${event.id}:${event.lat}:${event.lon}:${salt}`;
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return (value >>> 0) / 4294967296;
}

export function surfaceFrame(event) {
  const lat = THREE.MathUtils.degToRad(event.lat), lon = THREE.MathUtils.degToRad(event.lon);
  return {
    normal: latLonToVector(event.lat, event.lon),
    east: new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon)),
    north: new THREE.Vector3(-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)),
  };
}

export function surfacePoint(frame, east, north, altitude, target = new THREE.Vector3()) {
  return target.copy(frame.normal).addScaledVector(frame.east, east)
    .addScaledVector(frame.north, north).normalize().multiplyScalar(1 + altitude);
}

export function appearancesFor(events, simulatedStorm = false) {
  return events.filter(event => Number.isFinite(event.lat) && Number.isFinite(event.lon))
    .slice(0, WEATHER_EFFECTS.maxLocations).map(event => weatherAppearance(event, simulatedStorm));
}
