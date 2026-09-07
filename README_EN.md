# ORBIT · Explore the Universe. Sense the Earth.

[简体中文](README.md) | [English](README_EN.md)

Current version: **1.4.0**.

**Live demo:** [https://ryh842487118-bot.github.io/orbit/](https://ryh842487118-bot.github.io/orbit/)

Double-click **index.html** in this directory to launch ORBIT. Three.js and 15 textures, including Earth's original 8K day and night maps, are embedded in the HTML, so universe exploration requires no internet connection, dependency installation, or local server. EarthSense fetches public data on demand. A current version of Chrome, Edge, or Safari with WebGL 2 and hardware acceleration enabled is recommended.

## Demo Video

[![ORBIT universe explorer demo preview](demo-preview.jpg)](demo.mp4)

**[Watch the demo](demo.mp4)** · [Download MP4](https://github.com/ryh842487118-bot/orbit/raw/refs/heads/main/demo.mp4)

The 58-second video is recorded from the actual website at 1440 × 900 and 30 FPS. It visits Earth's night side, the International Space Station, the Moon, Jupiter, Saturn's rings, the Solar System, and the Milky Way before returning to Earth.

## Explore

- Drag to rotate the camera and use the mouse wheel to zoom. On touchscreens, drag with one finger to rotate and pinch with two fingers to zoom.
- Keep zooming out from Earth to move through the Solar System and into the Milky Way. Zoom back in to return to the tracked body.
- Select a body from the bottom dock, the 3D scene, or a label to fly smoothly to it.
- Use **City Lights** and **Visit the Space Station** from the Earth panel.
- Jump between **Near-Earth Orbit**, **Solar System**, and **Milky Way** using the navigation at the top.
- Toggle orbits and labels independently. Pause celestial motion or switch between 0.25×, 1×, 5×, and 20× simulation speeds.
- Keyboard shortcuts: `+` / `-` to zoom, Space to pause, `H` to return to Earth, `F` for fullscreen, `I` to hide the interface, and `?` for help.

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

ORBIT uses Three.js r185 and includes Earth day/night shading, city lights, an independent cloud layer, an atmospheric rim, 32 satellites, a simplified International Space Station, the Moon, the Sun, all eight planets, transparent Saturn rings, Solar System orbits, a procedurally generated spiral galaxy, logarithmic depth buffering, bloom post-processing, and a responsive interface.

This is an interactive visualization. Body sizes, distances, orbital positions, and speeds are adjusted for visual presentation rather than real-time astronomical accuracy. The satellite and space-station models are intentionally enlarged, and the galaxy is illustrative. Close-range HUD distances are converted from visual units and are intended for demonstration.

## Files

- `src/shell.html`: page structure and controls.
- `src/style.css`: interface styling and mobile layouts.
- `src/universe.js`: compatibility entry only; `src/app.js` assembles the application.
- `src/core/`: renderer, camera flights, scene assembly, textures.
- `src/universe/`: planets, orbits, satellites, simulation, and galaxy.
- `src/earth/`: day/night shading, atmosphere, clouds, geographic coordinates, and on-demand detailed textures.
- `src/earthsense/`: the current weather, lightning, and cyclone overlays, feed state, mode restoration, and illustrative weather effects in `effects/`.
- `src/data/`: Open-Meteo, NASA EONET, and GDACS adapters, wind-unit conversion, and shared requests; `cyclone-track.js` loads official cyclone tracks on demand.
- `src/ui/`: original controls, labels, EarthSense panel and event details.
- `tests/`: navigation, picking, restoration, caching, cancellation, adapter tests.
- `docs/`: validation and source documentation.
- `assets/`: original textures, attribution, and licenses.
- `build.mjs`: bundles the engine, scene code, and textures into one HTML file.
- `index.html`: self-contained build output.
- `demo.mp4`: recorded website demo.
- `demo-preview.jpg`: video preview used in the README.

Run `npm install`, `npm test`, and `npm run build` to install, validate, and rebuild. The generated `index.html` is written to the project root and uses only dependencies included in this repository.

Planet textures come from [Solar System Scope](https://www.solarsystemscope.com/textures/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and are displayed with real-time lighting and shaders. See `assets/CREDITS.md` for the full attribution list. Three.js is distributed under the MIT License; see `assets/THREE-LICENSE.txt`.
