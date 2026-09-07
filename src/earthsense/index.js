import * as THREE from 'three';
import { reducedMotion } from '../core/math.js';
import { createEarthSensePanel } from '../ui/earthsense-panel.js';
import { createEventPopup } from '../ui/event-popup.js';
import { createFeedStore } from './feeds.js';
import { createEarthSession } from './session.js';
import { layers } from './layers.js';
import { createEventSelection } from './selection.js';
import { loadCycloneTrack } from '../data/cyclone-track.js';

/** EarthSense borrows the world and camera; it never constructs either engine. */
export function createEarthSense({ world, camera, controls, navigation, ui, layerDefinitions = layers, createPanel = createEarthSensePanel, createPopup = createEventPopup, loadTrack = loadCycloneTrack }) {
  const session = createEarthSession(navigation, ui);
  const root = new THREE.Group();
  root.name = 'EarthSense surface layers';
  root.visible = false;
  world.earth.mesh.add(root);
  const views = new Map(), renderedEvents = new Map();
  let visible = false, panel;
  const feeds = createFeedStore(layerDefinitions, sync);
  const popup = createPopup({
    onFocus: event => navigation.focusEarth({ lat: event.lat, lon: event.lon, distance: 1.65 }),
    onClose: () => selection.clear(),
  });
  const selection = createEventSelection({ loadTrack, onChange(event, initial) {
    for (const [id, view] of views) view.setSelected?.(id === event?.layer ? event : null);
    if (!event) popup.close();
    else if (initial) popup.show(event);
    else popup.update?.(event);
  } });
  panel = createPanel({
    layers: layerDefinitions, onModeChange: setMode, onToggle: toggleLayer,
    onRefresh: () => { void feeds.refresh(true); },
    onSelect: event => selectEvent(event, true),
    onReturnEarth: () => navigation.flyTo('earth'),
  });

  function getState() {
    const state = feeds.snapshot();
    const dates = Object.values(state).map(layer => layer.updatedAt).filter(Boolean);
    return {
      active: session.active, visible, layers: state,
      loading: Object.values(state).some(layer => layer.status === 'loading'),
      events: feeds.visibleEvents(), updatedAt: dates.length ? Math.max(...dates) : null,
      selectedEvent: selection.getEvent(),
    };
  }

  function sync() {
    const state = getState();
    for (const definition of layerDefinitions) {
      const record = state.layers[definition.id];
      const events = feeds.events(definition.id);
      let view = views.get(definition.id);
      // Allocate GPU resources only after Earth is in view and the layer has data.
      if (visible && record.enabled && events.length && !view) {
        view = definition.createView();
        views.set(definition.id, view);
        root.add(view.group);
      }
      if (view) {
        if (renderedEvents.get(definition.id) !== events) {
          view.setEvents(events);
          renderedEvents.set(definition.id, events);
        }
        view.group.visible = record.enabled;
        const selected = selection.getEvent();
        view.setSelected?.(record.enabled && definition.id === selected?.layer ? selected : null);
      }
    }
    panel?.update(state);
  }

  function setMode(mode) {
    const active = mode === 'earthsense';
    if (active === session.active) return;
    if (active) session.enter();
    else session.leave();
    visible = false;
    root.visible = false;
    selection.clear();
    document.body.classList.toggle('earthsense-active', active);
    feeds.setActive(active);
    sync();
  }

  function toggleLayer(id, enabled) {
    feeds.setEnabled(id, enabled);
    if (!enabled && selection.getEvent()?.layer === id) selection.clear();
  }

  function selectEvent(event, focus = false) {
    if (!session.active || !feeds.snapshot()[event.layer]?.enabled) return;
    void selection.select(event);
    if (focus) navigation.focusEarth({ lat: event.lat, lon: event.lon, distance: 2.2 });
  }

  function update(time, { scaleFactor = 1 } = {}) {
    const state = navigation.getState();
    const shouldShow = session.active && state.focusBody === 'earth' && state.stage === 'earth'
      && camera.position.distanceTo(world.earth.position) < 12
      && controls.target.distanceTo(world.earth.position) < 2;
    if (visible !== shouldShow) {
      visible = shouldShow;
      root.visible = visible;
      if (!visible) selection.clear();
      sync();
    }
    if (visible) for (const view of views.values()) {
      if (view.group.visible) view.update(time, { reducedMotion, scaleFactor });
    }
  }

  function pick(raycaster) {
    if (!visible) return false;
    world.earth.mesh.updateWorldMatrix(true, true);
    // Test the opaque Earth, not its cloud or atmosphere shells, for occlusion.
    const surface = raycaster.intersectObject(world.earth.mesh, false)[0];
    const hits = [...views.values()].filter(view => view.group.visible)
      .map(view => view.pick(raycaster, surface?.distance ?? Infinity)).filter(Boolean)
      .sort((a, b) => a.distance - b.distance);
    if (hits.length) {
      const hit = hits[0], selected = selection.getEvent();
      if (hit.trackPoint && selected?.id === hit.event.id) {
        popup.show({ ...selected, trackPoint: hit.trackPoint, trackKind: hit.trackKind });
      } else selectEvent(hit.event);
      return true;
    }
    if (surface) { selection.clear(); return true; }
    return false;
  }

  sync();
  return {
    get active() { return session.active; },
    get visible() { return visible; },
    update, pick, setMode, getState, toggleLayer,
    // Serializable diagnostics support validation without exposing mutable Three.js objects.
    diagnostics: () => ({ ...getState(), eventCount: feeds.visibleEvents().length, renderedLayers: [...views.keys()],
      visuals: Object.fromEntries([...views].map(([id, view]) => [id, view.diagnostics?.() || {}])),
    }),
    dispose() { selection.dispose(); feeds.dispose(); for (const view of views.values()) view.dispose(); root.removeFromParent(); panel.dispose?.(); popup.dispose?.(); },
  };
}
