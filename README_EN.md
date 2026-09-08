# ORBIT · Explore the Universe. Sense the Earth.

[简体中文](README.md) | [English](README_EN.md)

Current version: **1.7.1**. See the [changelog](CHANGELOG.md).

**Live demo:** [https://ryh842487118-bot.github.io/orbit/](https://ryh842487118-bot.github.io/orbit/)

Double-click **index.html** in this directory to launch ORBIT. Three.js and 15 textures, including Earth's original 8K day and night maps, are embedded in the HTML, so universe exploration requires no internet connection, dependency installation, or local server. EarthSense fetches public data on demand. A current version of Chrome, Edge, or Safari with WebGL 2 and hardware acceleration enabled is recommended.

## Demo Video

[![ORBIT universe explorer demo preview](demo-preview.jpg)](demo.mp4)

**[Watch the demo](demo.mp4)** · [Download MP4](https://github.com/ryh842487118-bot/orbit/raw/refs/heads/main/demo.mp4)

The 25-second video is continuously recorded from the actual website at 1920 × 1080 and 25 FPS. It moves from Galactic motion trails to Earth, EarthSense, the Sun, an illustrated giant planet in the Large Magellanic Cloud, and a closing Local Group overview.

## New Feature Previews

Actual v1.6.0 screenshots; select an image to view it at full size. The fictional extragalactic planet retains its on-screen illustration label.

| Galactic motion trails | Sun-relative motion trails |
| --- | --- |
| ![Colored trails combining the Sun's forward motion with eight planetary orbits](docs/previews/motion-galactic.jpg) | ![Eight planetary paths around the Sun in the Sun-relative reference frame](docs/previews/motion-solar.jpg) |
| **EarthSense · Weather and thunderstorms** | **Massive star · R136a1** |
| ![Detailed Earth with weather, lightning, and cyclone layers in EarthSense](docs/previews/earthsense.jpg) | ![Artistic close-up of the real star R136a1 in the Large Magellanic Cloud](docs/previews/massive-star.jpg) |
| **Extragalactic giant planet · Illustration** | **Local Group · Five galaxies** |
| ![An illustrated giant planet in the Large Magellanic Cloud, explicitly labeled as fictional](docs/previews/extragalactic-planet.jpg) | ![Overview of the Milky Way, Andromeda, Triangulum, and the Large and Small Magellanic Clouds](docs/previews/local-group.jpg) |

## Demo & Community Response

[Watch the ORBIT demo on Douyin](https://v.douyin.com/fs-xgwuET1g), a Chinese short-video platform. The screenshot shows **4,319 likes, 1,292 favorites, 304 comments, and 920 shares**, reflecting interest in the project beyond GitHub. These figures come from the screenshot archived on September 8, 2026.

[![ORBIT demo on Douyin showing 4,319 likes, 1,292 favorites, 304 comments, and 920 shares](docs/previews/douyin-demo.png)](docs/previews/douyin-demo.png)

## Explore

- Drag to rotate the camera and use the mouse wheel to zoom. On touchscreens, drag with one finger to rotate and pinch with two fingers to zoom.
- Keep zooming out from Earth to move through the Solar System, the Milky Way, and the Local Group. Zoom back in to return to the tracked body.
- Select a body from the bottom dock, the 3D scene, or a label to fly smoothly to it.
- Explore **eight galaxies: the Milky Way, Andromeda, Triangulum, the Large and Small Magellanic Clouds, M32, M110, and NGC 6822**. Selecting a galaxy fills the bottom dock with its catalogued stars, planets, and black holes. Use the galaxy, stellar-system overview, and Local Group controls to move back through the navigation hierarchy.
- Visit **16 real stellar targets beyond the Sun**: Betelgeuse, HR 8799, AF And, AE And, Romano’s Star, R136a1, WOH G64, HD 5980, Proxima Centauri, Alpha Centauri A/B, Sirius A/B, Vega, Pollux, and Rigel. HD 5980 is a multiple-star system represented by one luminous object.
- Visit **five black holes**: Sagittarius A*, the central black holes of M31 and M32, and the stellar-mass black holes M33 X-7 and LMC X-1. Shadows, photon rings, and animated accretion disks are artistic illustrations.
- Explore **four confirmed giant planets, HR 8799 b, c, d, and e**, plus **four explicitly fictional extragalactic giant-planet illustrations**. The fictional planets and their placement beside real stars are demonstrations, not discoveries or measured orbits. All exoplanet surfaces are artistic. See [deep-space catalog and sources](docs/deep-space-sources.md).
- Use **City Lights** and **Visit the Space Station** from the Earth panel.
- Jump between **Near-Earth Orbit**, **Solar System**, **Milky Way**, and **Local Group** using the navigation at the top.
- Toggle orbits and labels independently. Pause celestial motion or switch between 0.25×, 1×, 5×, and 20× simulation speeds.
- Select **运动轨迹 (Motion Trails)** beside the orbit and label controls to follow the Sun and eight planets. Switch between Galactic and Sun reference frames and short or long histories, use the existing pause and speed controls, rotate and zoom freely, or choose **返回太阳系 (Return to Solar System)**.
- Warm meteoroids and comets with two soft tails occasionally cross the sky, one at a time at random intervals. They follow the pause control and are hidden in EarthSense and reduced-motion mode.
- Keyboard shortcuts: `+` / `-` to zoom, Space to pause, `H` to return to Earth, `F` for fullscreen, `I` to hide the interface, and `?` for help.

## Solar System Motion Trails

The Galactic reference view combines the Solar System’s overall translation with planetary motion around the Sun. The Sun reference view follows the Sun and removes that common translation so you can compare the paths. The Solar System does orbit the galactic center; NASA gives an orbital period of approximately 230 million years. [NASA Sun Facts](https://science.nasa.gov/sun/facts/), [NASA Solar System Facts](https://science.nasa.gov/solar-system/solar-system-facts/).

The Galactic reference is a **local illustration**. Historical trails are calculated backward from the demonstration model, with adjusted time, sizes, orbital periods, translation direction, and display proportions. A spiral shape seen from one viewpoint is not a unique true route through space or an observed ephemeris. See [motion-trail model and sources](docs/motion-trajectories.md).

## EarthSense

Choose **感知地球** to observe data on the existing Earth. The current interface has three independent layers: **weather, lightning, and tropical cyclones**, all enabled by default. Click a weather or thunderstorm cloud, or a cyclone cloud band, for its source, timestamp, coordinates, and measurements. Events are also searchable in the list; choose an entry to fly to its location, then zoom closer. Use the event list to inspect clear-weather locations with no clouds. The list places cyclones and lightning before weather samples.

EarthSense holds celestial motion while you explore the surface. Returning to universe mode restores the previous camera, destination, unfinished flight, speed and switches. Overlays hide when viewing another body or a wider astronomical scale. EarthSense uses the same Three.js Earth, renderer, camera and controls.

- Weather uses 60 Open-Meteo sampling locations to display temperature, wind, accumulated precipitation, rainfall, and cloud cover. Clear and mainly clear codes **0 and 1** produce no clouds or rain, and EarthSense hides the fixed decorative cloud map. Accumulation and its source interval are converted to mm/h to control rain density, speed, length, and spread. These samples do not form a continuous global weather field.
- Weather lightning appears only for thunderstorm codes **95, 96, and 99**. As the rain rate increases, its illustrative cycle shortens from about 18 seconds to 4 seconds. This animation expresses intensity; the source does not provide observed lightning frequency or individual strikes.
- Local weather clouds follow Earth's curvature, with translucent drifting wisps and shading that responds to the Sun. Thunderstorm flashes briefly illuminate their interiors. Cloud shape and motion are illustrative expressions of the sampled weather.
- Cyclones combine GDACS reports with up to 100 open severe-storm events from NASA EONET; matching duplicates prefer GDACS. Thin clouds, low eyewalls, open eyes, and unequal spiral bands use independently drifting detail and brief localized electrical glows. Reported wind continuously controls visual radius and rotation speed; GDACS event maxima and the selected advisory's current observations are labeled separately. Cloud shape and radius are illustrative, not satellite imagery or official wind boundaries; electrical glows do not represent observed strikes or lightning frequency.
- Selecting a cyclone loads its GDACS advisory's authentic history and forecast on demand. History uses a solid line, forecast a dashed line, and selectable positions show coordinates, wind speed, and validity time. Details retain the source and advisory time. Missing forecasts or an unidentified current advisory are explained without extrapolating a path. EONET supplies historical positions but no official forecast. Closing details, disabling cyclones, leaving Earth, or switching modes cancels the route request and clears the selected route.
- The separate lightning layer contains **six simulated thunderstorm locations**, clearly labeled and enabled by default. Their clouds, rain, and lightning are demonstrations.

Each layer distinguishes loading, empty results, failures, partial availability and stale cached data. Leaving the mode cancels requests and stops refreshing. See [data sources](docs/data-sources.md) and [refactor validation](docs/refactor-validation.md). Event times are source records and may be delayed.

Universe exploration and EarthSense share the same detailed Earth maps, finer geometry, original day/night shading, and original bloom settings. Switching modes preserves texture quality and lighting. Detailed maps prepare asynchronously at startup: desktop prefers **8192 × 4096**, while phone layouts or devices reporting no more than 4 GB of memory prefer **4096 × 2048**, subject to the GPU texture-size limit. Unsupported devices or failed loads retain the original 2K maps. The 4K upload is generated at runtime from the unchanged 8K source. The original decorative cloud map appears in universe mode; EarthSense displays local clouds and rain driven by sampled weather.

## Implementation

ORBIT uses Three.js r185 and includes Earth day/night shading, city lights, an independent cloud layer, an atmospheric rim, 32 satellites, a simplified International Space Station, the Moon, the Sun, all eight planets, transparent Saturn rings, and Solar System orbits. Deep-space exploration adds three procedural spiral galaxies, three irregular dwarf galaxies, two elliptical galaxies, five black-hole models, independent stellar systems, procedural star and giant-planet surfaces, and lighting directed toward each planet’s host star. Bodies and orbits appear according to viewing distance. The renderer uses logarithmic depth buffering, bloom post-processing, and a responsive interface.

This is an interactive visualization. Body sizes, distances, orbital positions, and speeds are adjusted for visual presentation rather than real-time astronomical accuracy. The satellite and space-station models are intentionally enlarged, and all eight galaxies are illustrative. Eight is the number of available destinations, not the total membership of the Local Group. Close-range HUD distances are converted from visual units and are intended for demonstration.

## Debugging Interface

After the page loads, call `ORBIT.destinations()` in the browser console to inspect the eight galaxies and 29 bodies beyond the Solar System. Entries provide IDs, names, kinds, galaxy membership, host stars, and model status. Existing Solar System destinations retain their original navigation IDs.

```js
console.table(ORBIT.destinations());
ORBIT.goTo('sagittarius-a'); // Explore the Milky Way’s central black hole
ORBIT.goTo('m32');          // Fly to M32
ORBIT.goTo('local-group'); // Local Group overview
ORBIT.goTo('andromeda');   // Fly to Andromeda
ORBIT.goTo('hr8799-b');    // Fly to a confirmed giant planet
ORBIT.getState();          // Includes activeGalaxyId, activeSystemId, and the current scale
```

In the new catalog, `modelStatus: 'confirmed'` identifies real objects, while `'illustration'` identifies fictional destinations. Surface artwork, scene proportions, and orbital animation remain illustrative for confirmed objects too.

## Files

- `src/shell.html`: page structure and controls.
- `src/style.css`: interface styling and mobile layouts.
- `src/universe.js`: compatibility entry only; `src/app.js` assembles the application.
- `src/core/`: renderer, camera flights, scene assembly, textures.
- `src/universe/`: body catalogs, planets, orbits, satellites, simulation, the Local Group, independent deep-space stellar systems, and illustrative motion trails.
- `src/earth/`: day/night shading, atmosphere, clouds, geographic coordinates, and on-demand detailed textures.
- `src/earthsense/`: the current weather, lightning, and cyclone overlays, feed state, mode restoration, and illustrative weather effects in `effects/`.
- `src/data/`: Open-Meteo, NASA EONET, and GDACS adapters, wind-unit conversion, and shared requests; `cyclone-track.js` loads official cyclone tracks on demand.
- `src/ui/`: original controls, labels, the motion-trail panel, EarthSense panel and event details.
- `tests/`: navigation, deep-space catalogs and orbital tracking, picking, restoration, caching, cancellation, and adapter tests.
- `docs/`: validation, public data documentation, deep-space sources, and the motion-trail model.
- `assets/`: original textures, attribution, and licenses.
- `build.mjs`: bundles the engine, scene code, and textures into one HTML file.
- `index.html`: self-contained build output.
- `demo.mp4`: recorded website demo.
- `demo-preview.jpg`: video preview used in the README.
- `docs/previews/`: actual screenshots of motion trails, EarthSense, deep-space bodies, and the Local Group.

Run `npm install`, `npm test`, and `npm run build` to install, validate, and rebuild. The generated `index.html` is written to the project root and uses only dependencies included in this repository.

Solar System textures come from [Solar System Scope](https://www.solarsystemscope.com/textures/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and are displayed with real-time lighting and shaders. The additional deep-space bodies use procedural artistic surfaces. See `assets/CREDITS.md` for the full attribution list. Three.js is distributed under the MIT License; see `assets/THREE-LICENSE.txt`.
