import * as THREE from 'three';

export const jwstDefinition = {
  id: 'jwst', cn: '詹姆斯·韦布', en: 'JAMES WEBB', index: 'L2', kind: 'observatory',
  type: '日地 L2 / 红外太空望远镜', r: 1.38, color: 0xe5bc69,
  stat1: '主镜口径', diameter: '6.5', unit1: 'm', stat2: '距地球约', value2: '150', unit2: '万 km',
  desc: '十八片镀金镜面收集微光，五层遮阳板隔开太阳的热。在红外波段，穿过尘埃寻找新生恒星，捕捉遥远星系的暗弱光芒。',
  sourceUrl: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/', sourceLabel: 'NASA · 望远镜结构',
};

// A small studio reflection field gives metal readable highlights without adding
// lights to the rest of the solar system. This is material lighting, not a photo.
function reflectionField() {
  const w = 256, h = 128, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const ribbon = Math.exp(-Math.pow((v - .38 - .12 * Math.sin(u * 6.28)) / .08, 2));
    const softbox = Math.exp(-Math.pow((u - .22) / .08, 2) - Math.pow((v - .43) / .3, 2));
    const rim = Math.exp(-Math.pow((u - .72) / .045, 2) - Math.pow((v - .5) / .2, 2));
    const value = Math.min(1, .06 + .45 * ribbon + .75 * softbox + .65 * rim);
    const i = (y * w + x) * 4;
    data[i] = value * 225; data[i+1] = value * 235; data[i+2] = value * 255; data[i+3] = 255;
  }
  const texture = new THREE.DataTexture(data, w, h);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

/** Detailed, proportioned display model. Orbit and spacecraft size remain illustrative. */
export function createJWST(scene, earth) {
  const group = new THREE.Group(); group.name = 'jwst'; scene.add(group);
  const pickMeshes = [], envMap = reflectionField();
  const keyLight = new THREE.PointLight(0xffebcc, 2.3, 5, 0); keyLight.position.set(-.6, 1.8, 2); group.add(keyLight);
  const fillLight = new THREE.PointLight(0xc5d9ff, 1.5, 4, 0); fillLight.position.set(-1.6, 1.4, -.4); group.add(fillLight);
  const shieldAssembly = new THREE.Group(); shieldAssembly.name = 'jwst-deployable-sunshield'; group.add(shieldAssembly);
  const secondaryParts = []; const wingParts = [[], []];
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffd36b, metalness: .96, roughness: .19,
    envMap, envMapIntensity: 2.6, clearcoat: .25, emissive: 0xc18a2f, emissiveIntensity: .32 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x202329, metalness: .55, roughness: .38, envMap, envMapIntensity: .7 });
  const titanium = new THREE.MeshStandardMaterial({ color: 0xcbd2d9, metalness: .85, roughness: .28, envMap, envMapIntensity: 1.1 });
  const foilGold = new THREE.MeshStandardMaterial({ color: 0xc29a51, metalness: .8, roughness: .4, envMap });
  const optical = new THREE.Group(); optical.name = 'jwst-optical-assembly';
  optical.position.set(0, .57, -.12); optical.rotation.x = -.09; group.add(optical);
  function add(geometry, material, position = [0,0,0], parent = group, name = '') {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.fromArray(position);
    mesh.name = name; mesh.userData.bodyId = 'jwst'; parent.add(mesh); pickMeshes.push(mesh); return mesh;
  }
  function rod(a, b, radius = .005, material = carbon, parent = group) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material, [0,0,0], parent);
    mesh.position.copy(from.add(to).multiplyScalar(.5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize());
    return mesh;
  }
  const hex = new THREE.Shape();
  for (let i=0;i<6;i++) { const a=i*Math.PI/3; const x=Math.cos(a)*.086, y=Math.sin(a)*.086; if(i)hex.lineTo(x,y);else hex.moveTo(x,y); } hex.closePath();
  const mirrorGeometry = new THREE.ExtrudeGeometry(hex, { depth: .007, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .0011, bevelThickness: .0011 });
  let mirrorIndex=0;
  for (let q=-2;q<=2;q++) for(let s=-2;s<=2;s++) {
    if(Math.max(Math.abs(q),Math.abs(s),Math.abs(q+s))>2||(!q&&!s))continue;
    const x=q*.132, y=(s+q/2)*.1524, z=(x*x+y*y)*.11;
    const assembly = new THREE.Group(); assembly.position.set(x,y,0); optical.add(assembly);
    if (Math.abs(q) === 2) wingParts[q < 0 ? 0 : 1].push(assembly);
    const mirror = add(mirrorGeometry, gold, [0,0,z], assembly, 'jwst-primary-segment-'+(++mirrorIndex));
    mirror.rotation.set(-y*.22,x*.22,0);
    // Each mirror sits in an individual black carrier with a rear actuator.
    const carrier=add(new THREE.CylinderGeometry(.087,.082,.025,6),carbon,[0,0,z-.019],assembly);
    carrier.rotation.x=Math.PI/2; carrier.rotation.y=Math.PI/6;
    add(new THREE.CylinderGeometry(.012,.012,.037,6),titanium,[0,0,-.055],assembly).rotation.x=Math.PI/2;
  }
  // Rear truss, side wing hinges and the black central aft-optics enclosure.
  for (const x of [-.28,0,.28]) {
    rod([x,-.29,-.065],[x,.28,-.065],.008,carbon,optical);
    rod([x,-.28,-.07],[0,0,-.17],.008,carbon,optical);
    rod([x,.28,-.07],[0,0,-.17],.008,carbon,optical);
  }
  for (const y of [-.23,.23]) rod([-.29,y,-.06],[.29,y,-.06],.009,carbon,optical);
  const central=add(new THREE.CylinderGeometry(.047,.062,.10,6),carbon,[0,0,.06],optical,'jwst-aft-optics');central.rotation.x=Math.PI/2;
  for(const x of [-.20,.20])for(const y of [-.24,.24])add(new THREE.BoxGeometry(.022,.043,.035),titanium,[x,y,-.035],optical);
  const secondary=[0,.018,.69];
  for(const anchor of [[0,.345,.02],[-.30,-.21,.02],[.30,-.21,.02]]) {
    secondaryParts.push(rod(anchor,secondary,.0065,carbon,optical));
    add(new THREE.SphereGeometry(.012,8,6),titanium,anchor,optical);
  }
  const housing=add(new THREE.CylinderGeometry(.048,.037,.034,24),carbon,secondary,optical,'jwst-secondary-housing');housing.rotation.x=Math.PI/2;secondaryParts.push(housing);
  const secondaryMirror=add(new THREE.SphereGeometry(.037,24,12,0,Math.PI*2,0,Math.PI/2),gold,[0,.018,.67],optical,'jwst-secondary-mirror');secondaryMirror.rotation.x=-Math.PI/2;secondaryMirror.scale.y=.22;secondaryParts.push(secondaryMirror);
  rod([-.07,.08,-.15],[-.07,.51,-.21],.025,titanium);rod([.07,.08,-.15],[.07,.51,-.21],.025,titanium);
  add(new THREE.BoxGeometry(.31,.26,.21),carbon,[0,.55,-.32],group,'jwst-instruments');
  for(const x of [-.12,0,.12])add(new THREE.BoxGeometry(.075,.22,.07),foilGold,[x,.53,-.46]);
  // Sunshield: 21.2 × 14.2 m relative to a 6.5 m primary mirror.
  // Tensioned membranes separate most at the perimeter and curve toward the hub.
  const outline=[[0,1.13],[.50,.62],[.77,-.13],[.46,-.87],[0,-1.13],[-.46,-.87],[-.77,-.13],[-.50,.62]];
  for(let layer=0;layer<5;layer++) {
    const positions=[], indices=[], colors=[], edge=[];
    const rings=14, segments=96, size=1-layer*.027;
    const baseY=-.13+layer*.042;
    function point(r,t) {
      const part=t*outline.length, i=Math.floor(part)%outline.length, f=part-Math.floor(part), next=(i+1)%outline.length;
      const x=THREE.MathUtils.lerp(outline[i][0],outline[next][0],f)*r*size;
      const z=THREE.MathUtils.lerp(outline[i][1],outline[next][1],f)*r*size;
      const fold=.007*Math.sin(t*Math.PI*48+r*5)*Math.sin(r*Math.PI);
      const y=baseY-(1-r*r)*(.018+layer*.01)+fold;
      return [x,y,z];
    }
    for(let ring=0;ring<=rings;ring++)for(let segment=0;segment<=segments;segment++) {
      const r=ring/rings,t=segment/segments,p=point(r,t);positions.push(...p);
      const c=.86+.10*Math.sin(t*Math.PI*16)+.04*Math.cos(r*17+t*32);
      colors.push(c,c,c);
      if(ring===rings)edge.push(...p);
      if(ring<rings&&segment<segments){const a=ring*(segments+1)+segment,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color:[0xb89aa7,0xc4a5bb,0xb4acbd,0xc3bdcf,0xd5d1dc][layer],vertexColors:true,
      metalness:.78,roughness:.36,side:THREE.DoubleSide,envMap,envMapIntensity:1.5,emissive:0x7c738b,emissiveIntensity:.17});
    add(geo,material,[0,0,0],shieldAssembly,'jwst-sunshield-layer-'+(layer+1));
    shieldAssembly.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(edge,3)),new THREE.LineBasicMaterial({color:0xdde1ec,transparent:true,opacity:.45})));
    // Radial tension seams are subtle, fine lines, not thick solid panels.
    for(let seam=0;seam<8;seam++) {
      const line=[];for(let ring=1;ring<=rings;ring++){const p=point(ring/rings,seam/8);p[1]+=.001;line.push(...p);}
      shieldAssembly.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(line,3)),new THREE.LineBasicMaterial({color:0xe3e2eb,transparent:true,opacity:.24})));
    }
  }
  // Deployed booms, spacecraft bus, antenna, solar array and aft momentum flap.
  for(const [x,z] of [[0,1.12],[.77,-.13],[-.77,-.13],[0,-1.12]])rod([0,-.18,0],[x,-.19,z],.011,titanium,shieldAssembly);
  add(new THREE.CylinderGeometry(.22,.22,.19,8),foilGold,[0,-.28,-.02],group,'jwst-spacecraft-bus');
  for(let i=0;i<8;i++){const a=i*Math.PI/4;add(new THREE.BoxGeometry(.07,.06,.025),carbon,[Math.sin(a)*.218,-.28,Math.cos(a)*.218-.02]).rotation.y=a;}
  const antenna=add(new THREE.SphereGeometry(.09,20,12,0,Math.PI*2,0,Math.PI*.4),titanium,[.23,-.38,.17],group,'jwst-antenna');antenna.rotation.z=2.3;antenna.scale.y=.45;
  rod([.12,-.3,0],[.23,-.38,.17],.01,titanium);
  const solar=new THREE.MeshStandardMaterial({color:0x132742,metalness:.6,roughness:.3,envMap});
  add(new THREE.BoxGeometry(.36,.008,.40),solar,[0,-.43,-.43],group,'jwst-solar-array');
  for(let x=-.16;x<.18;x+=.04)rod([x,-.424,-.62],[x,-.424,-.24],.0014,titanium);
  for(let z=-.62;z<-.23;z+=.05)rod([-.17,-.424,z],[.17,-.424,z],.0014,titanium);
  const flap=add(new THREE.BoxGeometry(.44,.006,.22),titanium,[0,-.10,-1.19],group,'jwst-momentum-flap');flap.rotation.x=.32;
  const wings = wingParts.map((parts, i) => {
    const wing = new THREE.Group(); wing.name = i ? 'jwst-right-wing' : 'jwst-left-wing';
    wing.position.x = i ? .20 : -.20; optical.add(wing); group.updateMatrixWorld(true);
    for (const part of parts) wing.attach(part);
    return wing;
  });
  const secondaryArm = new THREE.Group(); secondaryArm.name='jwst-deployable-secondary';
  secondaryArm.position.set(0,.345,.02); optical.add(secondaryArm); group.updateMatrixWorld(true);
  for (const part of secondaryParts) secondaryArm.attach(part);
  let deployment=1, targetDeployment=1;
  const smoothPhase=(start,end)=>{const t=THREE.MathUtils.clamp((deployment-start)/(end-start),0,1);return t*t*(3-2*t);};
  function poseDeployment() {
    const shield=smoothPhase(0,.45), tower=smoothPhase(.25,.60), secondary=smoothPhase(.5,.80), mirrors=smoothPhase(.72,1);
    shieldAssembly.scale.set(.20+.80*shield,.34+.66*shield,.23+.77*shield);
    optical.position.y=.32+.25*tower;
    secondaryArm.rotation.x=-(1-secondary)*Math.PI*.48;
    wings[0].rotation.y=(1-mirrors)*Math.PI*.64;
    wings[1].rotation.y=-(1-mirrors)*Math.PI*.64;
    flap.scale.z=.1+.9*shield;flap.position.z=-.30-.89*shield;
  }
  const body={...jwstDefinition,group,mesh:pickMeshes[0],pickMeshes,position:group.position};
  let time=0;
  const outward=new THREE.Vector3(),tangent=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  function update(dt,{paused=false,speed=1}={}) {
    if(!paused)time+=dt*speed*.035;
    if(deployment!==targetDeployment){const step=dt/8;deployment=targetDeployment>deployment?Math.min(targetDeployment,deployment+step):Math.max(targetDeployment,deployment-step);poseDeployment();}
    outward.copy(earth.position).normalize();tangent.crossVectors(up,outward).normalize();
    group.position.copy(earth.position).addScaledVector(outward,7).addScaledVector(tangent,Math.cos(time)*.55).addScaledVector(up,Math.sin(time)*.36);
    // Keep the display model upright in the same Y-up frame as OrbitControls.
    // Yaw follows its location; this display attitude is not flight telemetry.
    group.quaternion.setFromAxisAngle(up,Math.atan2(outward.x,outward.z));
  }
  update(0);return {body,update,
    setDeployment(expanded,{immediate=false}={}) {targetDeployment=expanded?1:0;if(immediate){deployment=targetDeployment;poseDeployment();}},
    getState:()=>({progress:deployment,targetExpanded:targetDeployment===1,animating:deployment!==targetDeployment,
      phase:deployment<.45?'遮阳板':deployment<.6?'光学支撑塔':deployment<.8?'副镜支架':'主镜侧翼'}),
  };
}
