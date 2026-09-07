# ORBIT · Universe Explorer Recreation Prompt

> This prompt describes the finished ORBIT experience. It is not a verbatim transcript of the original development conversation. Copy it into an AI coding tool to build your own version.
>
> Live demo: https://ryh842487118-bot.github.io/orbit/
>
> Source code: https://github.com/ryh842487118-bot/orbit

---

You are a frontend engineer specializing in Three.js, astronomical visualization, and interaction design. Build a complete, working 3D universe exploration website named **ORBIT · Universe Explorer**.

Do not stop at a proposal or code snippets. Create the complete project, run checks, fix issues, and deliver a page that can be opened directly.

## 1. Core Experience

The page opens with a close view of Earth. Users can drag to rotate, scroll to zoom, or select celestial bodies to fly toward them with smooth, continuous camera animations.

Include the following:

- Earth: a day/night boundary, nighttime city lights, clouds, and an atmospheric rim.
- Near-Earth space: moving satellites, a simplified International Space Station, and the Moon.
- The Solar System: the Sun and all eight planets, including translucent rings around Saturn.
- The Milky Way: a spiral structure composed of many stars, with an approximate Solar System location marker.

These elements should inhabit a coherent 3D space. Zooming out continuously should take users from near-Earth orbit to the Solar System and then to the galactic scale. Zooming in should return them toward the currently tracked body.

## 2. Visual Requirements

Use a dark space background and a refined, restrained interface that keeps the celestial bodies in focus.

- Use deep blue-black as the primary color and muted mint or cyan accents.
- Use real celestial textures rather than plain-colored spheres for the main planets.
- Give Earth a convincing sense of volume, day/night shading, and an atmosphere.
- Give the Sun surface detail and a moderate glow.
- Give Saturn's rings transparency and visible structure.
- Give the galaxy spiral arms, a brighter center, and variations in star density rather than uniformly scattered points.
- Use bloom sparingly to preserve surface detail.
- Use fine borders, translucent panels, and moderate background blur.
- Avoid unrelated decoration, marketing sections, or pop-ups.

You may adjust celestial sizes and distances for visual clarity, but explain on the page that this is an illustrative visualization rather than an exact astronomical simulation.

## 3. Page Layout

### Top Left

Display the ORBIT identity and a “Universe Explorer” subtitle.

### Top Center

Provide three scale shortcuts: Near-Earth Orbit / Solar System / Milky Way.

### Top Right

Provide a GitHub source link, a fullscreen button, and an instructions button. Make the GitHub URL configurable and open it in a new tab.

### Left Information Panel

Update the panel according to the current target, including:

- Chinese and English celestial names.
- Classification and a brief description.
- Relevant facts, such as diameter and orbital period.

For Earth, also provide “City Lights” and “Visit the Space Station” actions.

### Right Side

Provide an exploration-scale indicator and zoom-in and zoom-out buttons.

### Bottom

Provide a destination dock for the Sun, all eight planets, and the Moon, with thumbnails and names. Also include:

- An orbit visibility toggle.
- A label visibility toggle.
- Pause and resume controls.
- Simulation speeds of 0.25×, 1×, 5×, and 20×.

## 4. Camera and Interaction

Camera behavior is a priority. Implement it carefully:

1. Selecting a body should trigger a continuous flight with ease-in and ease-out rather than an instant camera jump.
2. Handle distance interpolation across large scales without abrupt acceleration or discontinuities.
3. Prevent the camera from entering celestial bodies.
4. When tracking a body, move the camera and its target with the body's orbital motion.
5. Allow dragging or zooming to immediately interrupt an automatic flight and return control to the user.
6. Show labels according to distance and hide them when they are behind a body or occluded by another body.
7. Support dragging and scrolling on desktop, plus one-finger rotation and pinch-to-zoom on mobile.

Keyboard shortcuts:

- `+` / `-`: zoom.
- Space: pause or resume.
- `H`: return to Earth.
- `F`: fullscreen.
- `I`: hide or restore the interface.
- `?`: instructions.

## 5. Technology and Deliverables

Use Three.js with appropriate shaders, particle systems, and post-processing. Address depth precision across the large scale range from near-Earth orbit to the galaxy, and manage pixel ratio and rendering load on mobile devices.

Suggested project structure:

```text
src/shell.html
src/style.css
src/universe.js
assets/
build.mjs
index.html
README.md
README_EN.md
```

The built `index.html` should embed the necessary scripts and textures. Users must be able to double-click it to run the core exploration experience without external CDNs or a backend server.

Use textures with suitable permissions and retain attribution and licenses. Show loading progress and provide a clear message if initialization fails.

Write Chinese and English README files covering controls, local usage, rebuilding, asset attribution, and configurable live-demo and GitHub links.

Do not include advertising, visitor analytics, or other external reporting services by default.

## 6. Verification Criteria

Before delivery, verify in a running browser that:

- The page opens successfully and the main textures load correctly.
- Camera transitions work continuously between Earth, the Moon, Saturn, the Sun, the Solar System, and the Milky Way.
- There are no obvious camera jumps or intersections with celestial bodies.
- Pause, speed controls, layer toggles, fullscreen, and keyboard shortcuts work.
- The mobile layout has no major overlaps and touch controls work.
- All buttons and links function correctly.
- The core exploration experience works offline.

Make reasonable implementation decisions independently. Complete the project, then refine it based on actual runtime behavior. In your final handoff, describe the deliverables, verification results, and any remaining limitations.
