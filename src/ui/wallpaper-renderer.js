import { TRAJECTORY_VIEW_DIRECTION } from '../universe/trajectory-catalog.js';
import * as THREE from 'three';
import { wallpaperFrame } from './wallpaper-settings.js';
import { createMotionTrajectories } from '../universe/motion-trajectories.js';

/** Borrow the scene for a single render; the exploration camera and objects stay intact. */
export function createWallpaperRenderer({ renderer, composer, scene, world, textures, mainCamera, resizeMain }) {
  const camera = new THREE.PerspectiveCamera(40, 1, .001, 10000000);
  const canvas = renderer.domElement, raycaster = new THREE.Raycaster();
  const backgroundCamera = new THREE.PerspectiveCamera(40,1,.001,10000000);
  let frame, elapsed = 0, trajectories = null, hitSubject = null;
  function resize(settings) {
    frame = wallpaperFrame(innerWidth, innerHeight);
    // Refresh the main camera projection and pixel budget as well as the canvas.
    resizeMain();
    canvas.style.cssText = `width:${frame.width}px;height:${frame.height}px;left:0;top:0;touch-action:none;`;
  }
  function frameSubject(position, radius, x, y, size, direction, roll = 0, bounds = null) {
    const opticalZoom=Math.max(1,size/100);
    size=Math.min(size,100);
    const aspect = frame.width / frame.height;
    const room = Math.min(Math.min(x,1-x)*2*aspect, Math.min(y,1-y)*2);
    let distance = radius / Math.sin(THREE.MathUtils.degToRad(20)) / (room*.88*size/100);
    camera.fov = 40; camera.zoom = opticalZoom; camera.aspect = aspect; camera.up.set(0,1,0);
    camera.position.copy(position).addScaledVector(direction.normalize(),distance);
    camera.lookAt(position); camera.rotateZ(THREE.MathUtils.degToRad(roll));
    if (bounds) {
      // Fit the oriented trajectory box, so long trails can fill a narrow screen.
      const inverse=camera.quaternion.clone().invert(), tangent=Math.tan(THREE.MathUtils.degToRad(20));
      const horizontal=2*Math.min(x,1-x)*aspect*tangent*.88*size/100;
      const vertical=2*Math.min(y,1-y)*tangent*.88*size/100;
      distance=0;
      for (const a of [0,1]) for (const b of [0,1]) for (const c of [0,1]) {
        const corner=new THREE.Vector3(bounds[a?'max':'min'][0],bounds[b?'max':'min'][1],bounds[c?'max':'min'][2]).sub(position).applyQuaternion(inverse);
        distance=Math.max(distance,corner.z+Math.abs(corner.x)/horizontal,corner.z+Math.abs(corner.y)/vertical);
      }
      camera.position.copy(position).addScaledVector(direction,distance);
    }
    camera.setViewOffset(frame.width,frame.height,(.5-x)*frame.width,(.5-y)*frame.height,frame.width,frame.height);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function direction(yaw, pitch, base = new THREE.Vector3(.15,.18,1)) {
    const spherical = new THREE.Spherical().setFromVector3(base.normalize());
    spherical.theta += THREE.MathUtils.degToRad(yaw);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi-THREE.MathUtils.degToRad(pitch),.04,Math.PI-.04);
    return new THREE.Vector3().setFromSpherical(spherical);
  }
  function render(dt, settings) {
    if (!frame) resize(settings);
    elapsed += dt;
    if (settings.mode === 'universe') {
      camera.copy(mainCamera);
      const center={left:.27,middle:.5,right:.73}[settings.center];
      camera.setViewOffset(frame.width,frame.height,(.5-center)*frame.width,0,frame.width,frame.height);
      camera.updateMatrixWorld();
      const original = composer.passes[0].camera;
      try { composer.passes[0].camera = camera; composer.render(); }
      finally { composer.passes[0].camera = original; }
      return;
    }
    let root, position, radius, body, galaxy, trajectoryState;
    if (settings.mode === 'trajectory') {
      trajectories ||= createMotionTrajectories(scene, textures, renderer.getPixelRatio());
      trajectories.setReferenceFrame(settings.reference); trajectories.setTrailLength(settings.trail);
      trajectories.update(dt,{ active:true, paused:dt===0, speed:1 });
      trajectoryState = trajectories.getState();
      root = trajectories.group; position = trajectories.getCenter();
      radius = new THREE.Vector3(...trajectoryState.bounds.size).length()/2;
      frameSubject(position,radius,{left:.27,middle:.5,right:.73}[settings.trajectoryCenter],.5,settings.zoom,
        direction(settings.trajectoryDragYaw,settings.trajectoryDragPitch,new THREE.Vector3(...TRAJECTORY_VIEW_DIRECTION)),0,trajectoryState.bounds);
      root.traverse(object => {
        const uniforms = object.material?.uniforms;
        if (uniforms?.uResolution) uniforms.uResolution.value.set(frame.width*renderer.getPixelRatio(),frame.height*renderer.getPixelRatio());
      });
      hitSubject = null;
    } else {
      body = world.bodies.get(settings.selected);
      galaxy = world.galaxyDefinitions.find(item => item.id === settings.selected);
      if (body) { root=body.group; position=body.position; radius=body.visualRadius ? body.visualRadius*1.1 : body.r*(body.rings?2.3:1.15); }
      else if (galaxy) {
        root = galaxy.id === 'galaxy' ? world.galaxy : world.nearbyGalaxies.galaxies.get(galaxy.id)?.group;
        position=world.getPosition(galaxy.id); radius=galaxy.radius*1.05;
      }
      if (!root) return;
      let base = galaxy ? new THREE.Vector3(.2,1,1.15).applyQuaternion(root.quaternion) : position.clone().negate();
      if (!galaxy && (base.lengthSq()<.001 || body.parentGalaxy)) base.set(.15,.18,1);
      if (body?.kind==='black-hole') base.set(.3,.08,1).applyQuaternion(body.accretionDisk.quaternion);
      frameSubject(position,radius,{left:.27,middle:.5,right:.73}[settings.center],.5,settings.zoom,
        direction(settings.focusYaw + (galaxy ? elapsed*.6 : body.kind==='black-hole' ? 0 : 37),settings.focusPitch,base));
      hitSubject = { body, position:position.clone(), radius };
    }
    const visibility = new Map(), materialValues = [];
    scene.traverse(object => visibility.set(object,object.visible));
    const rotation = body?.mesh.rotation.y;
    const starsPosition=world.backgroundStars.position.clone();
    const starUniforms=world.backgroundStars.material?.uniforms;
    const fixedProjection=starUniforms?.uFixedProjection.value;
    const starProjection=starUniforms?.uProjection.value.clone();
    const originalCamera = composer.passes[0].camera;
    try {
      const descendants = new Set(); root.traverse(object => descendants.add(object));
      scene.traverse(object => {
        if (object.isMesh || object.isLine || object.isPoints || object.isSprite) object.visible = descendants.has(object) && (visibility.get(object) || Boolean(galaxy));
      });
      for (let node=root;node;node=node.parent) node.visible=true;
      world.backgroundStars.visible=settings.starsVisible;
      world.backgroundStars.position.copy(camera.position);
      // Magnify only the subject: the distant sky keeps its original projection.
      if(starUniforms){
        backgroundCamera.aspect=frame.width/frame.height; backgroundCamera.updateProjectionMatrix();
        starUniforms.uFixedProjection.value=true;
        starUniforms.uProjection.value.copy(backgroundCamera.projectionMatrix);
      }
      if (settings.mode==='trajectory') root.traverse(object=>{
        if (object.name.startsWith('trajectory-trail-') && !settings.orbitsVisible) object.visible=false;
      });
      // This render-local policy never writes back to the shared preferences.
      const renderOrbits = settings.mode==='focus' ? false : settings.orbitsVisible;
      if (!renderOrbits) {
        world.orbitGroup.visible=false; world.earthOrbitGroup.visible=false;
        for (const line of world.deepSpace.orbitLines) line.visible=false;
      }
      world.earthSatellites.visible=false; world.station.visible=false;
      if (body?.id==='earth' && settings.satellitesVisible) {
        for (const satelliteRoot of [world.earthSatellites,world.station]) {
          satelliteRoot.traverse(object=>{object.visible=true;});
          for(let node=satelliteRoot;node;node=node.parent) node.visible=true;
        }
      }
      if (body) {
        body.mesh.visible=true; body.mesh.rotation.y=rotation+elapsed*.035;
        const observations=body.mesh.getObjectByName('EarthSense surface layers');
        if (observations) observations.visible=false;
      }
      if (galaxy) root.traverse(object => {
        const opacity=object.material?.uniforms?.uOpacity;
        if (opacity) { materialValues.push([opacity,'value',opacity.value]); opacity.value=.9; }
        if (object.isSprite) { materialValues.push([object.material,'opacity',object.material.opacity]); object.material.opacity=.15; }
      });
      composer.passes[0].camera=camera;
      if (body?.renderPreview) body.renderPreview(camera,elapsed,()=>composer.render());
      else composer.render();
    } finally {
      visibility.forEach((visible,object)=>{object.visible=visible;});
      world.backgroundStars.position.copy(starsPosition);
      if(starUniforms){starUniforms.uFixedProjection.value=fixedProjection;starUniforms.uProjection.value.copy(starProjection);}
      materialValues.forEach(([object,key,value])=>{object[key]=value;});
      if (body) body.mesh.rotation.y=rotation;
      if (trajectories) trajectories.group.visible=false;
      composer.passes[0].camera=originalCamera;
    }
  }
  return { resize, render,
    resetRotation() { elapsed=0; },
    hitTest(x,y) {
      if (!hitSubject) return false;
      const rect=canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);
      if (hitSubject.body) {
        hitSubject.body.group.updateWorldMatrix(true,true);
        return raycaster.intersectObjects(hitSubject.body.pickMeshes || [hitSubject.body.mesh],true).length>0;
      }
      return raycaster.ray.intersectsSphere(new THREE.Sphere(hitSubject.position,hitSubject.radius));
    },
    getState: () => ({ camera:camera.position.toArray(), trajectory:trajectories?.getState() || null }),
    exit() { frame=null; elapsed=0; hitSubject=null; if (trajectories) trajectories.group.visible=false; canvas.style.cssText='touch-action:none'; resizeMain(); },
  };
}
