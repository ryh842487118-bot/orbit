import { atmosphere } from "./atmosphere.js";
import { createClouds } from "./clouds.js";
function addEarthLayers(body, unitSphere, textures) {
  const atmosphereMesh = atmosphere(body.group, unitSphere, 1, 4427239, 1.1);
  const clouds = createClouds(unitSphere, textures, body.mesh.rotation.y);
  body.group.add(clouds);
  return { clouds, atmosphere: atmosphereMesh };
}
export {
  addEarthLayers
};
