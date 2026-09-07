import * as THREE from "three";
const pointVertex = `
 attribute float aSize;attribute vec3 aColor;varying vec3 vColor;uniform float uRatio;uniform float uPerspective;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vColor=aColor;vec4 mv=viewMatrix*modelMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uRatio*(uPerspective>0.0?uPerspective/max(1.0,-mv.z):1.0),.6,18.0);
 #include <logdepthbuf_vertex>
 }`;
const pointFragment = `
 varying vec3 vColor;uniform float uOpacity;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){float d=length(gl_PointCoord-.5)*2.0;if(d>1.0)discard;float a=pow(1.0-d,2.0);gl_FragColor=vec4(vColor,uOpacity*a);
 #include <logdepthbuf_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
function pointCloud(positions, colors, sizes, perspective, opacity, pixels) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { uRatio: { value: pixels }, uPerspective: { value: perspective }, uOpacity: { value: opacity } }, vertexShader: pointVertex, fragmentShader: pointFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(geo, mat);
}
export {
  pointCloud
};
