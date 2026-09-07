import * as THREE from "three";
const worldVertex = `
 varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vUv=uv;vWorldNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.0);vWorldPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;
 #include <logdepthbuf_vertex>
 }`;
function earthMaterial(textures) {
  return new THREE.ShaderMaterial({ uniforms: { uDay: { value: textures["earth-day"] }, uNight: { value: textures["earth-night"] } }, vertexShader: worldVertex, fragmentShader: `
 uniform sampler2D uDay;uniform sampler2D uNight;varying vec2 vUv;varying vec3 vWorldNormal;varying vec3 vWorldPosition;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
 vec3 n=normalize(vWorldNormal);vec3 l=normalize(-vWorldPosition);float ndl=dot(n,l);vec3 viewDir=normalize(cameraPosition-vWorldPosition);
 vec3 day=texture2D(uDay,vUv).rgb;vec3 night=texture2D(uNight,vUv).rgb;
 float daylight=smoothstep(-.13,.23,ndl);vec3 color=day*(.025+1.65*max(ndl,0.0));
 float nightMask=1.0-smoothstep(-.13,.18,ndl);color+=night*nightMask*3.1;
 float ocean=smoothstep(.025,.15,day.b-day.r);float spec=pow(max(dot(reflect(-l,n),viewDir),0.0),65.0)*ocean*daylight;
 color+=vec3(.45,.65,.8)*spec*.5;
 float rim=pow(1.0-max(dot(n,viewDir),0.0),3.7);color+=vec3(.05,.24,.64)*rim*(.2+.8*daylight);
 gl_FragColor=vec4(color,1.0);
 #include <logdepthbuf_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }` });
}
function addSunlight(scene) {
  scene.add(new THREE.AmbientLight(10271205, 0.19));
  scene.add(new THREE.PointLight(16774110, 3.4, 0, 0));
}
export {
  addSunlight,
  earthMaterial,
  worldVertex
};
