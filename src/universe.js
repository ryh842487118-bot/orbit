import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const assets = window.ORBIT_ASSETS;
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const smooth = (a,b,x) => THREE.MathUtils.smoothstep(x,a,b);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => innerWidth <= 600;
let randomSeed=20260906;
function random(){randomSeed=(Math.imul(randomSeed,1664525)+1013904223)|0;return (randomSeed>>>0)/4294967296;}
function gaussian(){return Math.sqrt(-2*Math.log(Math.max(.000001,random())))*Math.cos(TAU*random());}

const data = [
 {id:'sun',cn:'太阳',en:'SUN',index:'00',type:'太阳系 / 恒星',r:8,orbit:0,period:0,texture:'sun',color:0xffbe54,diameter:'1,392,700',stat2:'表面温度',value2:'5,500',unit2:'°C',desc:'每一束抵达地球的光，都曾在这里出发。太阳以引力维系着八大行星，也点亮了我们的世界。'},
 {id:'mercury',cn:'水星',en:'MERCURY',index:'01',type:'太阳系 / 类地行星',r:.48,orbit:22,period:88,phase:2.8,texture:'mercury',color:0xbab4a9,diameter:'4,879',value2:'88',unit2:'天',desc:'最靠近太阳的行星。遍布撞击坑的岩石表面，记录着太阳系早期漫长而激烈的历史。'},
 {id:'venus',cn:'金星',en:'VENUS',index:'02',type:'太阳系 / 类地行星',r:.95,orbit:32,period:225,phase:4.5,texture:'venus-atmosphere',color:0xe8c595,diameter:'12,104',value2:'224.7',unit2:'天',desc:'厚重的云层将这颗金色星球包裹。晨昏时分，它是地球天空中格外明亮的存在。'},
 {id:'earth',cn:'地球',en:'EARTH',index:'03',type:'太阳系 / 类地行星',r:1,orbit:45,period:365.25,phase:0,texture:'earth-day',color:0x73b8e4,diameter:'12,742',value2:'365.25',unit2:'天',desc:'越过蔚蓝的大气层，看见云海之下的万家灯火。这里，是我们在宇宙中的家。'},
 {id:'moon',cn:'月球',en:'MOON',index:'01',type:'地球系统 / 天然卫星',r:.273,orbit:3.9,period:27.3,phase:3.35,texture:'moon',color:0xc6c9ca,diameter:'3,474',value2:'27.3',unit2:'天',desc:'越过寂静的月海与环形山，回望远处的蓝色地球。月球，是距离我们最近的另一个世界。'},
 {id:'mars',cn:'火星',en:'MARS',index:'04',type:'太阳系 / 类地行星',r:.66,orbit:65,period:687,phase:1.5,texture:'mars',color:0xe6a27f,diameter:'6,779',value2:'687',unit2:'天',desc:'铁锈色的荒原、极地的冰盖，和曾经流淌过水的痕迹。红色星球正等待下一位远行者。'},
 {id:'jupiter',cn:'木星',en:'JUPITER',index:'05',type:'太阳系 / 气态巨行星',r:4.1,orbit:108,period:4333,phase:3.8,texture:'jupiter',color:0xdfc8ae,diameter:'139,820',value2:'11.86',unit2:'年',desc:'巨大的云带在这里涌动，风暴绵延数个世纪。放大观察大红斑，感受太阳系最大的行星。'},
 {id:'saturn',cn:'土星',en:'SATURN',index:'06',type:'太阳系 / 气态巨行星',r:3.45,orbit:155,period:10759,phase:.7,texture:'saturn',color:0xe6d3a3,diameter:'116,460',value2:'29.46',unit2:'年',desc:'无数冰粒与岩屑，汇成一圈轻盈而壮丽的光环。转动视角，看光线从土星环的缝隙中穿过。'},
 {id:'uranus',cn:'天王星',en:'URANUS',index:'07',type:'太阳系 / 冰巨行星',r:2.15,orbit:205,period:30687,phase:5.35,texture:'uranus',color:0xa7dedf,diameter:'50,724',value2:'84.0',unit2:'年',desc:'一颗几乎侧躺着自转的冰蓝色行星。遥远而静谧的大气之下，藏着寒冷的巨大世界。'},
 {id:'neptune',cn:'海王星',en:'NEPTUNE',index:'08',type:'太阳系 / 冰巨行星',r:2.08,orbit:252,period:60190,phase:2.5,texture:'neptune',color:0x6d90e4,diameter:'49,244',value2:'164.8',unit2:'年',desc:'太阳系最外侧的行星。在深蓝色的大气中，猛烈的风暴依然不知疲倦地穿行。'}
];
const specials={
 solar:{id:'solar',cn:'太阳系',en:'SOLAR SYSTEM',index:'08',type:'银河系 / 我们的行星系统',r:1,desc:'八颗行星，沿着各自的轨道绕太阳运行。继续缩小，让这片熟悉的星空成为银河中的一个光点。',diameter:'8',unit1:'颗',stat1:'行星',stat2:'中心恒星',value2:'太阳',unit2:''},
 galaxy:{id:'galaxy',cn:'银河系',en:'MILKY WAY',index:'∞',type:'本星系群 / 棒旋星系',r:1,desc:'无数恒星聚成流动的旋臂，而太阳只是其中一颗。跨越尺度，从银河重新找到我们的家。',diameter:'约 10 万',unit1:'光年',stat1:'恒星盘直径',stat2:'我们的坐标',value2:'猎户臂',unit2:''},
 iss:{id:'iss',cn:'空间站',en:'ISS',index:'LEO',type:'地球系统 / 国际空间站',r:.13,desc:'太阳能帆板在微光中展开，舷窗外是缓缓转动的地球。在这座轨道实验室，日出每天到来多次。',diameter:'约 400',unit1:'km',stat1:'典型轨道高度',stat2:'绕地球一周',value2:'约 90',unit2:'分钟'}
};
let scene,camera,renderer,composer,controls,bloom,earth,clouds,station,sun,galaxy,backgroundStars,solarMarker;
let paused=reducedMotion,speed=1,simTime=0,selected='earth',focusBody='earth',displayedId='earth',flight=null,orbitsVisible=true,labelsVisible=true,lastMode='earth';
let orbitGroup=new THREE.Group(),earthOrbitGroup=new THREE.Group(),earthSatellites=new THREE.Group();
let bodies=new Map(),textures={},labels=[],satellites=[],atmospheres=[];
const galaxyCenter=new THREE.Vector3(-18000,0,0),zero=new THREE.Vector3();
const temp=new THREE.Vector3(),temp2=new THREE.Vector3(),projected=new THREE.Vector3();
let lastFrameTime=performance.now();
const unitSphere=new THREE.SphereGeometry(1,96,64);
let pixels=1,uiTick=0,toastTimer;

function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function fail(message){const loading=$('loading');if(loading)loading.style.display='none';$('error').hidden=false;$('error-message').textContent=message;}
window.addEventListener('error',e=>{console.error(e.error||e.message);if(!renderer)fail('加载出现问题。请使用支持 WebGL 2 的新版 Chrome、Edge 或 Safari 打开此文件。');});
async function loadTextures(){
 const loader=new THREE.TextureLoader();const keys=[...new Set([...data.map(d=>d.texture),'earth-night','earth-clouds','saturn-rings'])];let count=0;
 await Promise.all(keys.map(async name=>{const t=await loader.loadAsync(assets[name]);t.colorSpace=name==='earth-clouds'?THREE.NoColorSpace:THREE.SRGBColorSpace;t.anisotropy=8;textures[name]=t;$('load-progress').style.width=`${++count/keys.length*90}%`;}));
}

const worldVertex=`
 varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vWorldPosition;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vUv=uv;vWorldNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.0);vWorldPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;
 #include <logdepthbuf_vertex>
 }`;
function earthMaterial(){return new THREE.ShaderMaterial({uniforms:{uDay:{value:textures['earth-day']},uNight:{value:textures['earth-night']}},vertexShader:worldVertex,fragmentShader:`
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
 }`});}
function atmosphere(body,r,color,strength=.65){
 const mat=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uStrength:{value:strength}},vertexShader:worldVertex,fragmentShader:`
 uniform vec3 uColor;uniform float uStrength;varying vec3 vWorldNormal;varying vec3 vWorldPosition;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){vec3 n=normalize(vWorldNormal);vec3 v=normalize(cameraPosition-vWorldPosition);float rim=pow(1.0-abs(dot(n,v)),3.5);float light=.22+.78*max(dot(n,normalize(-vWorldPosition)),0.0);gl_FragColor=vec4(uColor*1.5,rim*light*uStrength);
 #include <logdepthbuf_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.BackSide});
 const shell=new THREE.Mesh(unitSphere,mat);shell.scale.setScalar(r*1.037);body.add(shell);atmospheres.push(shell);return shell;
}
function glowTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.15,'rgba(255,255,255,.7)');g.addColorStop(.4,'rgba(255,255,255,.15)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
const glowMap=glowTexture();
function glow(color,size,opacity=1){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.setScalar(size);return s;}
function makeOrbit(radius,color=0x65798d,opacity=.26,tilt=0){const points=[];for(let i=0;i<=256;i++){const a=i/256*TAU;points.push(new THREE.Vector3(Math.cos(a)*radius,Math.sin(a)*radius*Math.sin(tilt),Math.sin(a)*radius*Math.cos(tilt)));}return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));}
function makeLabel(id,name,stationLabel=false){const el=document.createElement('button');el.className='celestial-label'+(stationLabel?' station':'');el.innerHTML='<i></i><span></span>';el.querySelector('span').textContent=name;el.title='前往'+name;el.tabIndex=-1;el.onclick=()=>flyTo(id);$('labels').appendChild(el);labels.push({id,el});}

function makePlanets(){
 scene.add(orbitGroup,earthOrbitGroup,earthSatellites);
 scene.add(new THREE.AmbientLight(0x9cb9e5,.19));const sunlight=new THREE.PointLight(0xfff3de,3.4,0,0);scene.add(sunlight);
 for(const d of data){
  const group=new THREE.Group();scene.add(group);
  const mat=d.id==='earth'?earthMaterial():new THREE.MeshPhongMaterial({map:textures[d.texture],shininess:d.id==='sun'?0:8,specular:0x171c23});
  if(d.id==='sun'){mat.emissiveMap=textures.sun;mat.emissive=new THREE.Color(0xffbc62);mat.emissiveIntensity=2.4;mat.color.set(0x000000);}
  const mesh=new THREE.Mesh(unitSphere,mat);mesh.scale.setScalar(d.r);mesh.rotation.y=d.id==='earth'?2.9:random()*TAU;group.add(mesh);mesh.userData.bodyId=d.id;
  const body={...d,group,mesh,position:group.position};bodies.set(d.id,body);
  if(d.orbit&&d.id!=='moon'){const ring=makeOrbit(d.orbit,d.color,d.id==='earth'?.33:.2,d.id==='mercury'?.075:.015);ring.userData.baseOpacity=ring.material.opacity;orbitGroup.add(ring);}
  if(d.id==='earth'){
   earth=body;atmosphere(group,1,0x438de7,1.1);
   clouds=new THREE.Mesh(unitSphere,new THREE.MeshPhongMaterial({map:textures['earth-clouds'],alphaMap:textures['earth-clouds'],transparent:true,opacity:.64,depthWrite:false,shininess:2}));clouds.scale.setScalar(1.008);clouds.rotation.y=mesh.rotation.y;group.add(clouds);
  }
  if(d.id==='venus')atmosphere(group,d.r,0xd8a86a,.35);
  if(d.id==='mars')atmosphere(group,d.r,0xe8b097,.14);
  if(d.id==='uranus'||d.id==='neptune')atmosphere(group,d.r,d.color,.45);
  if(d.id==='sun'){sun=body;group.add(glow(0xffae42,43,.45));group.add(glow(0xffd390,24,.55));}
  if(d.id==='saturn'){
   const ringGeo=new THREE.RingGeometry(d.r*1.22,d.r*2.3,180,1);const uv=ringGeo.attributes.uv,p=ringGeo.attributes.position;
   for(let i=0;i<p.count;i++){const rad=Math.hypot(p.getX(i),p.getY(i));uv.setXY(i,(rad-d.r*1.22)/(d.r*1.08),.5);}uv.needsUpdate=true;
   const ringMat=new THREE.MeshPhongMaterial({map:textures['saturn-rings'],side:THREE.DoubleSide,transparent:true,opacity:.97,depthWrite:false,shininess:0});
   const rings=new THREE.Mesh(ringGeo,ringMat);rings.rotation.x=-Math.PI/2;const tilted=new THREE.Group();tilted.rotation.z=.466;mesh.rotation.z=.466;tilted.add(rings);group.add(tilted);body.rings=rings;
  }
  if(d.id==='uranus')mesh.rotation.z=1.7;
  makeLabel(d.id,d.cn);
 }
 const moonOrbit=makeOrbit(3.9,0x738ba3,.21,.07);earthOrbitGroup.add(moonOrbit);makeSatellites();
}
function box(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m;}
function cylinder(r,len,mat){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),mat);m.rotation.z=Math.PI/2;return m;}
function makeSatellites(){
 const metal=new THREE.MeshStandardMaterial({color:0xc7cbd0,roughness:.45,metalness:.65});const foil=new THREE.MeshStandardMaterial({color:0xdfbc72,roughness:.5,metalness:.6});
 const panel=new THREE.MeshStandardMaterial({color:0x234e79,roughness:.32,metalness:.52,emissive:0x10294f,emissiveIntensity:.3});
 for(let i=0;i<32;i++){
  const g=new THREE.Group(),r=1.16+random()*.6;g.add(box(.026,.027,.023,i%3?metal:foil));g.add(box(.075,.002,.034,panel,-.053));g.add(box(.075,.002,.034,panel,.053));g.add(box(.135,.003,.004,metal));earthSatellites.add(g);
  const inclination=.25+random()*2.5,ascending=random()*TAU,phase=random()*TAU;const quat=new THREE.Quaternion().setFromEuler(new THREE.Euler(inclination,ascending,0));
  satellites.push({group:g,r,quat,phase,velocity:(.10+random()*.10)*(i%3===0?-1:1)});
  if(i<7){const path=makeOrbit(r,0x609bba,.12);path.quaternion.copy(quat);earthOrbitGroup.add(path);}
 }
 station=new THREE.Group();const truss=box(.44,.013,.013,metal);station.add(truss);
 station.add(cylinder(.021,.20,metal));const main=cylinder(.027,.105,metal);main.rotation.y=Math.PI/2;main.position.z=.038;station.add(main);
 for(let i=0;i<4;i++){const x=(i-1.5)*.116;for(const z of [-.10,.10]){const p=box(.085,.003,.135,panel,x,0,z);station.add(p);for(let s=0;s<6;s++)station.add(box(.0008,.004,.135,metal,x-.038+s*.015,0,z));}station.add(box(.007,.007,.35,metal,x));}
 station.add(box(.035,.027,.055,foil,.11,.016,.02));const cupola=new THREE.Mesh(new THREE.SphereGeometry(.016,8,6),new THREE.MeshStandardMaterial({color:0x59829c,metalness:.75,roughness:.15}));cupola.position.set(-.015,.027,.065);station.add(cupola);station.rotation.set(.22,.35,.18);scene.add(station);
 makeLabel('iss','ISS · 国际空间站',true);
 const stationOrbit=makeOrbit(1.33,0x88d9ca,.3,.55);earthOrbitGroup.add(stationOrbit);
}

const pointVertex=`
 attribute float aSize;attribute vec3 aColor;varying vec3 vColor;uniform float uRatio;uniform float uPerspective;
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){vColor=aColor;vec4 mv=viewMatrix*modelMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uRatio*(uPerspective>0.0?uPerspective/max(1.0,-mv.z):1.0),.6,18.0);
 #include <logdepthbuf_vertex>
 }`;
const pointFragment=`
 varying vec3 vColor;uniform float uOpacity;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){float d=length(gl_PointCoord-.5)*2.0;if(d>1.0)discard;float a=pow(1.0-d,2.0);gl_FragColor=vec4(vColor,uOpacity*a);
 #include <logdepthbuf_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
function pointCloud(positions,colors,sizes,perspective,opacity){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('aColor',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));const mat=new THREE.ShaderMaterial({uniforms:{uRatio:{value:pixels},uPerspective:{value:perspective},uOpacity:{value:opacity}},vertexShader:pointVertex,fragmentShader:pointFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});return new THREE.Points(geo,mat);}
function makeStars(){
 const pos=[],cols=[],sizes=[];for(let i=0;i<(mobile()?4500:8000);i++){const a=random()*TAU,z=random()*2-1,r=Math.sqrt(1-z*z);pos.push(r*Math.cos(a)*110000,z*110000,r*Math.sin(a)*110000);const c=new THREE.Color().setHSL(.53+random()*.17,.08+random()*.3,.5+random()*.42);cols.push(c.r,c.g,c.b);sizes.push((random()<.035?3:1)*(random()*1.25+.65));}backgroundStars=pointCloud(pos,cols,sizes,0,.9);backgroundStars.frustumCulled=false;scene.add(backgroundStars);
 const gp=[],gc=[],gs=[];const num=mobile()?36000:65000;
 for(let i=0;i<num;i++){
  const bulge=i<num*.19;let x,z,y,r;
  if(bulge){r=Math.pow(random(),1.3)*4200;const a=random()*TAU;x=Math.cos(a)*r;z=Math.sin(a)*r;y=gaussian()*950*(1-r/5000);}
  else{r=1500+Math.pow(random(),.68)*27000;const arm=Math.floor(random()*4);const a=arm*Math.PI/2+Math.log(r/1600)*1.8+gaussian()*.16;x=Math.cos(a)*r+gaussian()*480;z=Math.sin(a)*r+gaussian()*480;y=gaussian()*(100+r*.012);}
  gp.push(x,y,z);const mix=clamp(r/25000,0,1);const c=new THREE.Color(0xffd8a8).lerp(new THREE.Color(0x88b8ec),mix);if(random()>.85)c.set(0xdbe7ff);const power=.65+random()*1.4;gc.push(c.r*power,c.g*power,c.b*power);gs.push((bulge?3:2)+random()*3.5);
 }
 galaxy=pointCloud(gp,gc,gs,24000,0);galaxy.position.copy(galaxyCenter);galaxy.rotation.x=.13;scene.add(galaxy);
 solarMarker=glow(0xa6ffef,650,.7);solarMarker.position.copy(zero);scene.add(solarMarker);makeLabel('solar','太阳系 · 你在这里');
}

function updateBodies(dt){
 if(!paused)simTime+=dt*speed;
 for(const b of bodies.values()){
  if(b.id==='moon')continue;
  if(b.orbit){const a=(b.phase||0)+simTime*TAU/b.period*.55;const inclination=b.id==='mercury'?.075:.015;b.position.set(Math.cos(a)*b.orbit,Math.sin(a)*b.orbit*Math.sin(inclination),Math.sin(a)*b.orbit*Math.cos(inclination));}
  if(!paused)b.mesh.rotation.y+=dt*speed*(b.id==='sun'?.015:b.id==='earth'?.035:.025);
 }
 const moon=bodies.get('moon'),ma=moon.phase+simTime*.12;
 moon.position.copy(earth.position).add(temp.set(Math.cos(ma)*3.9,Math.sin(ma)*3.9*Math.sin(.07),Math.sin(ma)*3.9*Math.cos(.07)));
 earthOrbitGroup.position.copy(earth.position);earthSatellites.position.copy(earth.position);
 if(!paused)clouds.rotation.y+=dt*speed*.04;
 const a=simTime*.16+2.35;station.position.copy(earth.position).add(temp.set(Math.cos(a)*1.33,Math.sin(a)*1.33*Math.sin(.55),Math.sin(a)*1.33*Math.cos(.55)));
 if(!paused)station.rotation.y+=dt*speed*.016;
 for(const sat of satellites){const a=sat.phase+simTime*sat.velocity;sat.group.position.set(Math.cos(a)*sat.r,0,Math.sin(a)*sat.r).applyQuaternion(sat.quat);sat.group.quaternion.copy(sat.quat);sat.group.rotateY(-a);}
}
function getPosition(id,out=new THREE.Vector3()){if(id==='galaxy')return out.copy(galaxyCenter);if(id==='solar')return out.set(0,0,0);if(id==='iss')return out.copy(station.position);return out.copy(bodies.get(id).position);}
function getData(id){return bodies.get(id)||specials[id];}
function destinationDistance(id){if(id==='galaxy')return 68000;if(id==='solar')return 650;if(id==='iss')return .88;const d=getData(id);return d.r*(id==='saturn'?8.6:id==='sun'?5.5:4.65)*(mobile()?1.19:1);}
function destinationDirection(id,night=false){
 if(id==='galaxy')return new THREE.Vector3(.14,1.2,1.55).normalize();if(id==='solar')return new THREE.Vector3(.18,1.15,1.45).normalize();
 if(id==='iss'){const outward=station.position.clone().sub(earth.position).normalize();const tangent=new THREE.Vector3().crossVectors(outward,new THREE.Vector3(0,1,0)).normalize();return outward.addScaledVector(tangent,.35).add(new THREE.Vector3(0,.15,0)).normalize();}
 const p=getPosition(id);if(id==='earth')return night?p.normalize().multiplyScalar(1.1).add(new THREE.Vector3(0,.14,.3)).normalize():new THREE.Vector3(2.1,.95,3.8).normalize();
 const towardSun=p.normalize().negate();return towardSun.multiplyScalar(.9).add(new THREE.Vector3(.3,.48,1.15)).normalize();
}
function updateInfo(id){
 displayedId=id;
 const d=getData(id);$('info-category').textContent=d.type;$('info-en').textContent=d.en;$('info-name').textContent=d.cn;const index=document.createElement('span');index.className='object-index';index.textContent=d.index;$('info-name').append(index);$('info-description').textContent=d.desc;
 $('stat-label-1').textContent=d.stat1||'平均直径';$('stat-label-2').textContent=d.stat2||'公转周期';
 $('stat-value-1').replaceChildren(document.createTextNode(d.diameter));const u1=document.createElement('small');u1.textContent=' '+(d.unit1||'km');$('stat-value-1').append(u1);
 $('stat-value-2').replaceChildren(document.createTextNode(d.value2));const u2=document.createElement('small');u2.textContent=' '+d.unit2;$('stat-value-2').append(u2);
 $('earth-actions').style.display=(id==='earth'||id==='iss')?'':'none';$('observation-text').textContent=id==='galaxy'?'银河旋臂 · 示意模型':id==='solar'?'八大行星 · 轨道运行中':'正在追踪'+d.cn;
 document.querySelectorAll('.planet-button').forEach(b=>{b.classList.toggle('active',b.dataset.id===id);b.setAttribute('aria-pressed',String(b.dataset.id===id));});
 const active=document.querySelector('.planet-button.active');if(active&&mobile())active.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'nearest',inline:'center'});
}
function flyTo(id,{night=false,immediate=false}={}){
 if(!getData(id))return;selected=id;if(bodies.has(id)||id==='iss')focusBody=id;updateInfo(id);controls.minDistance=focusBody==='iss'?.20:getData(focusBody).r*1.13;controls.maxDistance=180000;
 const startOffset=camera.position.clone().sub(controls.target);
 flight={id,night,start:performance.now(),duration:immediate||reducedMotion?1:id==='galaxy'?2600:1800,startTarget:controls.target.clone(),startDir:startOffset.clone().normalize(),startDist:startOffset.length(),endDist:destinationDistance(id),endDir:destinationDirection(id,night)};
 controls.enabled=false;controls.update();
 if(night)toast('正在飞向地球夜侧');else if(id==='iss')toast('正在接近国际空间站');
}
function updateFlight(now){
 const f=flight;if(!f)return;const t=clamp((now-f.start)/f.duration,0,1),e=t*t*(3-2*t);const end=getPosition(f.id);controls.target.lerpVectors(f.startTarget,end,e);f.endDir.copy(destinationDirection(f.id,f.night));const dir=temp.lerpVectors(f.startDir,f.endDir,e);if(dir.lengthSq()<.000001)dir.copy(f.endDir);dir.normalize();const dist=Math.exp(THREE.MathUtils.lerp(Math.log(f.startDist),Math.log(f.endDist),e));camera.position.copy(controls.target).addScaledVector(dir,dist);keepOutsideBodies();controls.update();if(t>=1){flight=null;controls.enabled=true;}
}
function trackingCenter(dist){
 const d=getData(focusBody),target=getPosition(focusBody);
 const leave=smooth(Math.max(d.r*9,8),Math.max(d.r*25,75),dist);target.lerp(zero,leave);
 target.lerp(galaxyCenter,smooth(1800,30000,dist));return target;
}
function updateTracking(dt){
 const dist=camera.position.distanceTo(controls.target),d=getData(focusBody),target=trackingCenter(dist);
 temp.copy(target).sub(controls.target).multiplyScalar(1-Math.exp(-dt*8));controls.target.add(temp);camera.position.add(temp);
 const effectiveMin=focusBody==='iss'?.20:d.r*1.13;
 controls.minDistance=effectiveMin;
 controls.update();keepOutsideBodies();
}
function keepOutsideBodies(){
 let corrected=false;for(const b of bodies.values()){temp2.copy(camera.position).sub(b.position);const min=b.r*1.018;if(temp2.lengthSq()<min*min){if(temp2.lengthSq()<.000001)temp2.set(0,0,1);camera.position.copy(b.position).add(temp2.setLength(min));corrected=true;}}
 if(corrected)camera.lookAt(controls.target);
}
function zoom(factor){if(flight){flight=null;controls.enabled=true;}const offset=camera.position.clone().sub(controls.target);offset.setLength(clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();}
function stage(){const dist=camera.position.distanceTo(controls.target);return dist>2600?'galaxy':dist>Math.max(28,getData(focusBody).r*10)?'solar':'earth';}
function updateVisibility(){
 const dist=camera.position.distanceTo(controls.target);const galFade=smooth(1400,18000,dist);galaxy.material.uniforms.uOpacity.value=galFade*.85;galaxy.visible=galFade>.001;solarMarker.visible=dist>2700;solarMarker.material.opacity=galFade*.8;solarMarker.scale.setScalar(clamp(dist*.01,60,1200));
 const earthDistance=camera.position.distanceTo(earth.position);earthSatellites.visible=earthDistance<70;station.visible=earthDistance<150;earthOrbitGroup.visible=orbitsVisible&&earthDistance<60;orbitGroup.visible=orbitsVisible&&dist>8&&dist<11000;
 const orbitFade=smooth(8,35,dist)*(1-smooth(1200,11000,dist));for(const line of orbitGroup.children)line.material.opacity=line.userData.baseOpacity*orbitFade;
 const mode=stage();if(mode!==lastMode){lastMode=mode;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===mode));if(mode==='galaxy')toast('进入银河尺度 · 继续放大可返回太阳系');}
 if(!flight){const infoId=mode==='earth'?focusBody:mode;if(displayedId!==infoId)updateInfo(infoId);selected=infoId;}
}
const cameraDirection=new THREE.Vector3(),occlusionRay=new THREE.Vector3();
function updateLabels(){
 const dist=camera.position.distanceTo(controls.target);const viewW=innerWidth,viewH=innerHeight;
 for(const item of labels){
  const b=getData(item.id);let show=labelsVisible;
  if(item.id==='solar')show=show&&dist>2800;
  else if(item.id==='iss')show=show&&camera.position.distanceTo(station.position)<11;
  else if(item.id==='moon')show=show&&camera.position.distanceTo(earth.position)<55&&selected!=='iss';
  else show=show&&dist<1400&&camera.position.distanceTo(b.position)<1400&&item.id!==selected;
  if(!show){item.el.style.opacity='0';item.el.style.pointerEvents='none';continue;}
  const p=getPosition(item.id);projected.copy(p).project(camera);
  const px=(projected.x*.5+.5)*viewW,py=(-projected.y*.5+.5)*viewH;
  show=projected.z>-1&&projected.z<1&&px>18&&px<viewW-65&&py>115&&py<viewH-180;
  if(show&&item.id!=='solar'){
   const toP=p.clone().sub(camera.position),len=toP.length();toP.normalize();
   for(const o of bodies.values()){
    if(o.id===item.id)continue;occlusionRay.copy(o.position).sub(camera.position);const along=occlusionRay.dot(toP);if(along>0&&along<len){const perpendicular=occlusionRay.lengthSq()-along*along;if(perpendicular<o.r*o.r*.99){show=false;break;}}
   }
  }
  // Leave the information column clear on desktop.
  if(!mobile()&&px<340&&py>145&&py<innerHeight-215)show=false;
  item.el.style.opacity=show?'1':'0';item.el.style.pointerEvents=show?'auto':'none';
  if(show){let radiusPx=item.id==='solar'?4:(b.r||.13)/Math.max(.1,camera.position.distanceTo(p))*innerHeight/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*.5;radiusPx=clamp(radiusPx,5,110);item.el.style.transform=`translate(${Math.round(px+radiusPx+8)}px,${Math.round(py-5)}px)`;}
 }
}
function updateHud(){
 const dist=camera.position.distanceTo(controls.target),mode=stage();
 if(mode==='galaxy'){$('view-caption').textContent='银河系全景';$('view-distance').textContent='旋臂与恒星盘';}
 else if(mode==='solar'){$('view-caption').textContent='太阳系全景';$('view-distance').textContent='八大行星运行轨道';}
 else{const d=getData(focusBody);$('view-caption').textContent=focusBody==='earth'?'地球近轨':d.cn+(focusBody==='iss'?'近景':'观测');const surface=Math.max(0,camera.position.distanceTo(getPosition(focusBody))-(d.r||1));$('view-distance').textContent=focusBody==='iss'?'地球低轨道':`距表面约 ${Math.round(surface/Math.max(.001,d.r)*Number((d.diameter||'12742').replaceAll(',',''))/2).toLocaleString('zh-CN')} km`;}
}
function resize(){
 const w=innerWidth,h=innerHeight;pixels=Math.min(devicePixelRatio,mobile()?1.5:1.8);renderer.setPixelRatio(pixels);renderer.setSize(w,h);camera.aspect=w/h;camera.setViewOffset(w,h,mobile()?0:-w*.105,mobile()?-h*.045:0,w,h);camera.updateProjectionMatrix();composer.setPixelRatio(pixels);composer.setSize(w,h);if(galaxy)galaxy.material.uniforms.uRatio.value=pixels;if(backgroundStars)backgroundStars.material.uniforms.uRatio.value=pixels;
}
function setPaused(value){paused=value;$('pause').innerHTML=paused?'<svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg>':'<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>';$('pause').setAttribute('aria-label',paused?'继续天体运动':'暂停天体运动');$('pause').title=paused?'继续（空格）':'暂停（空格）';}
function bindUI(){
 const dock=$('planet-list');for(const d of data){const button=document.createElement('button');button.className='planet-button'+(d.id==='earth'?' active':'');button.dataset.id=d.id;button.title='前往'+d.cn;button.setAttribute('aria-pressed',String(d.id==='earth'));const img=document.createElement('img');img.src=assets[d.texture];img.alt='';const span=document.createElement('span');span.textContent=d.cn;button.append(img,span);button.onclick=()=>flyTo(d.id);dock.append(button);}
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>flyTo(b.dataset.view));$('home').onclick=e=>{e.preventDefault();flyTo('earth');};$('overview').onclick=()=>flyTo('solar');$('night-view').onclick=()=>flyTo('earth',{night:true});$('station-view').onclick=()=>flyTo('iss');$('zoom-in').onclick=()=>zoom(.72);$('zoom-out').onclick=()=>zoom(1.45);$('pause').onclick=()=>setPaused(!paused);
 $('speed').onclick=()=>{const speeds=[.25,1,5,20];speed=speeds[(speeds.indexOf(speed)+1)%speeds.length];$('speed').firstChild.textContent=speed+'×';toast('演示时间流速 '+speed+'×');};
 $('toggle-orbits').onclick=()=>{orbitsVisible=!orbitsVisible;$('toggle-orbits').setAttribute('aria-pressed',String(orbitsVisible));};$('toggle-labels').onclick=()=>{labelsVisible=!labelsVisible;$('toggle-labels').setAttribute('aria-pressed',String(labelsVisible));};
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('此浏览器暂不支持全屏，可使用浏览器的全屏模式');}catch{toast('全屏未开启，可使用浏览器的全屏模式');}}
 $('fullscreen').onclick=fullscreen;$('help-button').onclick=()=>$('help-dialog').showModal();$('credits-button').onclick=()=>$('credits-dialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
 addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;const tag=e.target.tagName;if(['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(tag)&&e.code==='Space')return;
  if(e.code==='Space'){e.preventDefault();setPaused(!paused);}if(e.key==='+'||e.key==='=')zoom(.8);if(e.key==='-')zoom(1.25);if(e.key.toLowerCase()==='h')flyTo('earth');if(e.key.toLowerCase()==='f')fullscreen();if(e.key.toLowerCase()==='i'){document.body.classList.toggle('immersive');toast(document.body.classList.contains('immersive')?'沉浸模式 · 按 I 恢复界面':'已恢复界面');}if(e.key==='?')$('help-dialog').showModal();
 });
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let press=null,multiTouch=false;const touches=new Set();
 renderer.domElement.addEventListener('pointerdown',e=>{touches.add(e.pointerId);if(touches.size>1){multiTouch=true;press=null;}else{multiTouch=false;press={x:e.clientX,y:e.clientY,t:performance.now()};}if(flight){flight=null;controls.enabled=true;}},{capture:true});
 renderer.domElement.addEventListener('pointerup',e=>{touches.delete(e.pointerId);if(!press||multiTouch||Math.hypot(e.clientX-press.x,e.clientY-press.y)>5||performance.now()-press.t>450)return;press=null;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...bodies.values()].map(b=>b.mesh));if(hits.length)flyTo(hits[0].object.userData.bodyId);});
 renderer.domElement.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);press=null;});
 renderer.domElement.addEventListener('wheel',()=>{if(flight){flight=null;controls.enabled=true;}},{passive:true,capture:true});
 setPaused(paused);
}
let hidden=false;
function animate(now){
 requestAnimationFrame(animate);const dt=Math.min((now-lastFrameTime)/1000,.05);lastFrameTime=now;if(hidden)return;
 // Follow orbital motion exactly, including at 20×; smooth only a change in exploration scale.
 const dist=camera.position.distanceTo(controls.target),before=flight?null:trackingCenter(dist);updateBodies(dt);
 if(flight)updateFlight(now);else{const motion=trackingCenter(dist).sub(before);controls.target.add(motion);camera.position.add(motion);updateTracking(dt);}
 backgroundStars.position.copy(camera.position);updateVisibility();
 if(++uiTick%2===0)updateLabels();if(uiTick%10===0)updateHud();composer.render();
}
async function init(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x03070d);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=THREE.SRGBColorSpace;$('universe').append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('图形上下文已丢失。请关闭占用显卡的页面后，重新加载星空。');});
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.001,350000);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.zoomSpeed=1.65;controls.rotateSpeed=.5;controls.minDistance=1.13;controls.maxDistance=180000;controls.maxPolarAngle=Math.PI-.02;controls.minPolarAngle=.02;
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.42,.65,1.18);composer.addPass(bloom);composer.addPass(new OutputPass());resize();
  await loadTextures();makePlanets();makeStars();updateBodies(0);controls.target.copy(earth.position);camera.position.copy(earth.position).addScaledVector(destinationDirection('earth'),destinationDistance('earth'));controls.update();bindUI();resize();
  $('load-progress').style.width='100%';$('load-text').textContent='欢迎回到地球';
  // Compile once before presenting the first completed frame.
  await renderer.compileAsync(scene,camera);composer.render();$('loading').classList.add('done');setTimeout(()=>$('loading').remove(),900);
  addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{hidden=document.hidden;lastFrameTime=performance.now();});requestAnimationFrame(animate);
  // Read-only diagnostics for local validation and future maintenance.
  window.ORBIT={version:'1.0.0',getState:()=>({selected,stage:stage(),paused,speed,flight:!!flight,distance:camera.position.distanceTo(controls.target),planetCount:data.filter(d=>d.orbit&&d.id!=='moon').length,satelliteCount:satellites.length,galaxyStars:galaxy.geometry.attributes.position.count,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),goTo:flyTo,zoom,setPaused};
 }catch(error){console.error(error);fail('无法初始化三维场景。请确认浏览器已开启硬件加速，或使用新版 Chrome、Edge、Safari 重试。');}
}
init();
