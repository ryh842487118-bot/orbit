import { normalizeWallpaperSettings, nextWallpaperBody, nextTrajectoryPreset, clampWallpaperZoom } from './wallpaper-settings.js';

export function bindWallpaperMode(canvas, { world, controls, navigation, view, setSpaceColor, setOrbitsVisible }) {
  const $ = id => document.getElementById(id);
  const button = $('wallpaper'), dialog = $('settings-dialog');
  const hiddenRoots = new Map(), pointers = new Map();
  const bodies = [...world.bodies.values()].filter(body => body.mesh);
  const subjects = [...bodies,...world.galaxyDefinitions], ids = subjects.map(body=>body.id);
  let settings;
  try { settings=normalizeWallpaperSettings(JSON.parse(localStorage.getItem('orbit.wallpaper') || '{}')); }
  catch { settings=normalizeWallpaperSettings(); }
  if (!ids.includes(settings.selected)) settings.selected='earth';
  let active=false, press=null, taps=null, tapTimer=null, multi=false, pinching=null;
  let clock=0, savedNavigation=null, hintTimer=null;
  const descriptions = {
    universe:'保留当前宇宙、镜头与动画，仅隐藏文字和控件。拖动与缩放照常，双击恢复界面。',
    focus:'只展示一颗旋转星体或一个完整星系，保留光晕与星环。三击主体切换，双击恢复界面。',
    trajectory:'太阳与八颗行星持续留下运动轨迹。选择运动参照、轨迹长度和左中右位置，画面自动适应屏幕。双击恢复界面。',
  };
  for (const [label,items] of [['星体',bodies],['星系',world.galaxyDefinitions]]) {
    const group=document.createElement('optgroup'); group.label=label;
    group.replaceChildren(...items.map(body=>new Option(body.cn+(body.modelStatus==='illustration'?' · 示意':''),body.id)));
    $('wallpaper-selected').append(group);
  }
  function save() {
    try { localStorage.setItem('orbit.wallpaper',JSON.stringify(settings)); } catch { /* Storage is optional in private browsing. */ }
  }
  function sync() {
    for (const [key,value] of Object.entries(settings)) {
      const input=$(`wallpaper-${key}`);
      if (input) { if (input.type==='checkbox') input.checked=value; else input.value=value; }
    }
    document.querySelectorAll('[data-wallpaper-mode]').forEach(node=>{node.hidden=node.dataset.wallpaperMode!==settings.mode;});
    document.querySelectorAll('[data-wallpaper-composition]').forEach(node=>{node.hidden=settings.mode==='trajectory';});
    $('wallpaper-mode-description').textContent=descriptions[settings.mode];
  }
  function cancelTaps() { clearTimeout(tapTimer); tapTimer=null; taps=null; }
  function configure(patch) {
    const reenter=active && patch.mode && patch.mode!==settings.mode;
    if (reenter) setActive(false);
    settings=normalizeWallpaperSettings({...settings,...patch});
    if (!ids.includes(settings.selected)) settings.selected='earth';
    clock=0; save(); sync(); setSpaceColor(settings.spaceColor); setOrbitsVisible(settings.orbitsVisible);
    if (reenter) setActive(true);
  }
  function select(id) {
    if (!ids.includes(id)) return false;
    cancelTaps(); view.resetRotation(); configure({selected:id,focusYaw:0,focusPitch:0}); return true;
  }
  function next(direction=1) { if (settings.mode==='focus') select(nextWallpaperBody(ids,settings.selected,direction)); }
  function setActive(value) {
    if (value===active) return;
    active=value; document.body.classList.toggle('immersive',value); button.setAttribute('aria-pressed',String(value));
    cancelTaps(); press=pinching=null; pointers.clear(); clock=0;
    clearTimeout(hintTimer);
    const hint=$('screen-mode-hint');
    hint.classList.remove('show');
    if (value) {
      document.querySelectorAll('dialog[open]').forEach(node=>node.close());
      if (settings.mode!=='universe') { savedNavigation=navigation.snapshot(); controls.enabled=false; }
      for (const element of document.body.children) {
        if (['universe','error','screen-mode-hint'].includes(element.id) || ['SCRIPT','STYLE'].includes(element.tagName)) continue;
        hiddenRoots.set(element,element.inert); element.inert=true;
      }
      view.resize(settings); $('universe').focus({preventScroll:true});
      hint.textContent=settings.mode==='focus'?'双击退出 · 三击星体切换':settings.mode==='trajectory'?'双击退出 · 三击切换参照与长短轨迹':'双击退出';
      hint.classList.add('show');
      hintTimer=setTimeout(()=>hint.classList.remove('show'),4500);
    } else {
      hint.textContent='';
      view.exit();
      if (savedNavigation) { navigation.restore(savedNavigation); savedNavigation=null; }
      hiddenRoots.forEach((inert,element)=>{element.inert=inert;}); hiddenRoots.clear();
      button.focus({preventScroll:true});
    }
  }
  button.setAttribute('aria-pressed','false'); button.onclick=()=>setActive(true);
  $('settings-button').onclick=()=>{sync();dialog.showModal();};
  $('wallpaper-start').onclick=()=>setActive(true);
  for (const key of Object.keys(settings)) {
    const input=$(`wallpaper-${key}`);
    input?.addEventListener('input',()=>{
      if (key==='selected') select(input.value);
      else configure({[key]:input.type==='checkbox'?input.checked:input.value});
    });
  }
  $('wallpaper-reset').onclick=()=>{ view.resetRotation(); configure(normalizeWallpaperSettings()); };
  canvas.addEventListener('pointerdown',event=>{
    if (!active || event.button>0) return;
    // A third press must cancel the pending double-tap before its release.
    if (taps?.count===2 && performance.now()-taps.time<380) clearTimeout(tapTimer);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size>1) {
      multi=true; press=null; cancelTaps();
      const [a,b]=[...pointers.values()]; pinching={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:settings.zoom}; return;
    }
    multi=false;
    press={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,time:performance.now(),moved:false};
  });
  canvas.addEventListener('pointermove',event=>{
    if (!active || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (pinching && pointers.size===2) {
      if (settings.mode!=='universe' && pinching.distance>0) {
        const [a,b]=[...pointers.values()];
        settings.zoom=clampWallpaperZoom(pinching.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinching.distance);
      }
      return;
    }
    if (press) {
      const dx=event.clientX-press.lastX, dy=event.clientY-press.lastY;
      if (settings.mode!=='universe') {
        const prefix=settings.mode==='trajectory'?'trajectoryDrag':'focus';
        settings[`${prefix}Yaw`]=((settings[`${prefix}Yaw`]-dx*.45+540)%360)-180;
        settings[`${prefix}Pitch`]=Math.min(85,Math.max(-85,settings[`${prefix}Pitch`]+dy*.45));
      }
      press.lastX=event.clientX; press.lastY=event.clientY;
      if (Math.hypot(event.clientX-press.x,event.clientY-press.y)>8) {press.moved=true;cancelTaps();}
    }
  });
  canvas.addEventListener('pointerup',event=>{
    if (!active || !pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (multi || !press) { if (!pointers.size) {pinching=null;save();sync();} return; }
    const now=performance.now(), start=press; press=null;
    save(); sync();
    if (start.moved || now-start.time>300) {cancelTaps();return;}
    const near=taps && now-taps.time<380 && Math.hypot(event.clientX-taps.x,event.clientY-taps.y)<28;
    const hit=settings.mode==='focus' && view.hitTest(event.clientX,event.clientY);
    taps={x:event.clientX,y:event.clientY,time:now,count:near?taps.count+1:1,subject:hit && (!near || taps.subject)};
    if (taps.count===3) { const switchSubject=taps.subject; cancelTaps(); if(settings.mode==='trajectory') configure(nextTrajectoryPreset(settings.reference,settings.trail)); else if(switchSubject) next(); return; }
    if (taps.count===2) {
      if (settings.mode!=='universe') tapTimer=setTimeout(()=>setActive(false),380);
      else setActive(false);
    }
  });
  canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);press=pinching=null;multi=true;cancelTaps();save();});
  canvas.addEventListener('wheel',event=>{
    if (!active || settings.mode==='universe') return;
    event.preventDefault();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
    configure({zoom:clampWallpaperZoom(settings.zoom*Math.exp(-Math.max(-200,Math.min(200,delta))*.0015))});
  },{passive:false});
  save(); sync(); setSpaceColor(settings.spaceColor); setOrbitsVisible(settings.orbitsVisible);
  return { get satellitesVisible(){return settings.satellitesVisible;}, get starsVisible(){return settings.starsVisible;}, get active(){return active;}, get isolated(){return settings.mode!=='universe';}, configure, select, next,
    getState:()=>({active,...settings,bodies:ids,render:view.getState()}),
    enter:()=>setActive(true), toggle:()=>setActive(!active), exit:()=>setActive(false), resize:()=>view.resize(settings),
    update(dt) {
      if (!active) return;
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (settings.mode==='focus' && settings.autoplay && !pointers.size && !taps && !reduced) {
        clock+=dt; if(clock>=settings.interval) next();
      }
      if(taps?.count===1 && performance.now()-taps.time>380) cancelTaps();
      view.render(reduced?0:dt,settings);
    },
  };
}
