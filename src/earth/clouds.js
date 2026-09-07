import * as THREE from "three";
function createClouds(unitSphere, textures, rotation) {
  const clouds = new THREE.Mesh(unitSphere, new THREE.MeshPhongMaterial({ map: textures["earth-clouds"], alphaMap: textures["earth-clouds"], transparent: true, opacity: 0.64, depthWrite: false, shininess: 2 }));
  clouds.scale.setScalar(1.008);
  clouds.rotation.y = rotation;
  return clouds;
}
export {
  createClouds
};
