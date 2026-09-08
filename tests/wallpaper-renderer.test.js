import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWallpaperRenderer } from '../src/ui/wallpaper-renderer.js';
import { WALLPAPER_DEFAULTS } from '../src/ui/wallpaper-settings.js';

test('portrait hides orbits locally and respects satellites without changing shared state', () => {
  const oldWidth=globalThis.innerWidth,oldHeight=globalThis.innerHeight;
  globalThis.innerWidth=390;globalThis.innerHeight=844;
  const scene=new THREE.Scene(), group=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1),new THREE.MeshBasicMaterial());group.add(mesh);scene.add(group);
  const world={bodies:new Map([['earth',{id:'earth',r:1,group,mesh,position:group.position}]]),galaxyDefinitions:[],deepSpace:{orbitLines:[new THREE.Group()]}};
  for(const key of ['backgroundStars','orbitGroup','earthOrbitGroup','earthSatellites','station']){world[key]=new THREE.Group();scene.add(world[key]);}
  const satellite=new THREE.Mesh(mesh.geometry,mesh.material);world.earthSatellites.add(satellite);satellite.visible=false;
  world.earthSatellites.visible=false;world.station.visible=false;
  scene.add(world.deepSpace.orbitLines[0]);
  const camera=new THREE.PerspectiveCamera();let expectedSatellites=true;
  const composer={passes:[{camera}],render(){
    assert.equal(world.orbitGroup.visible,false);assert.equal(world.earthOrbitGroup.visible,false);assert.equal(world.deepSpace.orbitLines[0].visible,false);
    assert.equal(world.earthSatellites.visible,expectedSatellites);assert.equal(world.station.visible,expectedSatellites);
  }};
  const view=createWallpaperRenderer({renderer:{domElement:{style:{}}},composer,scene,world,mainCamera:camera,resizeMain(){}});
  const settings={...WALLPAPER_DEFAULTS,mode:'focus',orbitsVisible:true};
  try{
    view.render(.01,settings);
    assert.equal(settings.orbitsVisible,true);assert.equal(world.orbitGroup.visible,true);
    assert.equal(world.earthSatellites.visible,false);assert.equal(satellite.visible,false);assert.equal(composer.passes[0].camera,camera);
    expectedSatellites=false;view.render(.01,{...settings,satellitesVisible:false});
    assert.equal(world.orbitGroup.visible,true);
    view.render(.01,{...settings,satellitesVisible:false,zoom:100});
    const normal=view.getState().camera;
    view.render(.01,{...settings,satellitesVisible:false,zoom:1200});
    assert.deepEqual(view.getState().camera,normal,'large magnification does not drive the camera inside the body');
  }finally{globalThis.innerWidth=oldWidth;globalThis.innerHeight=oldHeight;mesh.geometry.dispose();mesh.material.dispose();}
});

test('roaming composition places the camera target left, middle or right without mutating exploration',()=>{
  const oldWidth=globalThis.innerWidth,oldHeight=globalThis.innerHeight;
  globalThis.innerWidth=240;globalThis.innerHeight=240;
  const mainCamera=new THREE.PerspectiveCamera(40,1,.01,1000);mainCamera.position.set(0,0,10);mainCamera.lookAt(0,0,0);mainCamera.updateMatrixWorld();
  let expected=.5;
  const composer={passes:[{camera:mainCamera}],render(){
    const position=new THREE.Vector3().project(composer.passes[0].camera);
    assert(Math.abs((position.x+1)/2-expected)<1e-8);
    assert(Math.abs(position.y)<1e-8);
  }};
  const view=createWallpaperRenderer({renderer:{domElement:{style:{}}},composer,scene:new THREE.Scene(),world:{},mainCamera,resizeMain(){}});
  try{
    for(const [center,x] of [['left',.27],['middle',.5],['right',.73]]){expected=x;view.render(0,{...WALLPAPER_DEFAULTS,mode:'universe',center});assert.equal(mainCamera.view,null);assert.equal(composer.passes[0].camera,mainCamera);}
  }finally{globalThis.innerWidth=oldWidth;globalThis.innerHeight=oldHeight;}
});
