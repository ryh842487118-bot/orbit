# ORBIT · Journey Through the Universe

[简体中文](README.md) | [English](README_EN.md)

Double-click **index.html** in this directory to launch ORBIT. Three.js and all 13 textures are embedded in the HTML, so no internet connection, dependency installation, or local server is required. A current version of Chrome, Edge, or Safari with WebGL 2 and hardware acceleration enabled is recommended.

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

## Implementation

ORBIT uses Three.js r185 and includes Earth day/night shading, city lights, an independent cloud layer, an atmospheric rim, 32 satellites, a simplified International Space Station, the Moon, the Sun, all eight planets, transparent Saturn rings, Solar System orbits, a procedurally generated spiral galaxy, logarithmic depth buffering, bloom post-processing, and a responsive interface.

This is an interactive visualization. Body sizes, distances, orbital positions, and speeds are adjusted for visual presentation rather than real-time astronomical accuracy. The satellite and space-station models are intentionally enlarged, and the galaxy is illustrative. Close-range HUD distances are converted from visual units and are intended for demonstration.

## Files

- `src/shell.html`: page structure and controls.
- `src/style.css`: interface styling and mobile layouts.
- `src/universe.js`: Three.js scene, shaders, and navigation.
- `assets/`: original textures, attribution, and licenses.
- `build.mjs`: bundles the engine, scene code, and textures into one HTML file.
- `index.html`: self-contained build output.
- `demo.mp4`: recorded website demo.
- `demo-preview.jpg`: video preview used in the README.

To rebuild, run `npm install` followed by `npm run build`. The generated `index.html` is written to the project root and uses only dependencies included in this repository.

Planet textures come from [Solar System Scope](https://www.solarsystemscope.com/textures/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and are displayed with real-time lighting and shaders. See `assets/CREDITS.md` for the full attribution list. Three.js is distributed under the MIT License; see `assets/THREE-LICENSE.txt`.
