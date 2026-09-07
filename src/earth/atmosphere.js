import * as THREE from "three";
import { worldVertex } from "./lighting.js";
function atmosphere(body, unitSphere, r, color, strength = 0.65) {
  const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } }, vertexShader: worldVertex, fragmentShader: `
 uniform vec3 uColor;uniform float uStrength;varying vec3 vWorldNormal;varying vec3 vWorldPosition;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){vec3 n=normalize(vWorldNormal);vec3 v=normalize(cameraPosition-vWorldPosition);float rim=pow(1.0-abs(dot(n,v)),3.5);float light=.22+.78*max(dot(n,normalize(-vWorldPosition)),0.0);gl_FragColor=vec4(uColor*1.5,rim*light*uStrength);
 #include <logdepthbuf_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide });
  const shell = new THREE.Mesh(unitSphere, mat);
  shell.scale.setScalar(r * 1.037);
  body.add(shell);
  return shell;
}
export {
  atmosphere
};
