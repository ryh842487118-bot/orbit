/** Move existing controls into small-screen sheets, preserving their handlers and state. */
export function bindCompactUI() {
  const query=matchMedia('(max-width: 700px), (max-height: 600px)');
  const infoPanel=document.getElementById('info-panel');
  const bottomUI=document.querySelector('.bottom-ui');
  function fitDetails() {
    if(query.matches || innerHeight>900){
      infoPanel.style.removeProperty('--info-available-height');
      return;
    }
    const available=bottomUI.getBoundingClientRect().top-infoPanel.getBoundingClientRect().top-16;
    infoPanel.style.setProperty('--info-available-height',`${Math.max(0,available)}px`);
  }
  const layoutObserver=new ResizeObserver(fitDetails);
  layoutObserver.observe(bottomUI);
  layoutObserver.observe(infoPanel);
  addEventListener('resize',fitDetails);
  const bar=document.createElement('div');bar.className='compact-bar ui';
  const infoButton=document.createElement('button');infoButton.id='compact-info';infoButton.setAttribute('aria-haspopup','dialog');
  const exploreButton=document.createElement('button');exploreButton.id='compact-explore';exploreButton.textContent='探索与控制 ⌃';exploreButton.setAttribute('aria-haspopup','dialog');
  bar.append(infoButton,exploreButton);document.body.append(bar);
  function sheet(id,title) {
    const dialog=document.createElement('dialog');dialog.id=id;dialog.className='compact-sheet';
    dialog.setAttribute('aria-label',title);
    const header=document.createElement('div');header.className='compact-sheet-header';
    const label=document.createElement('strong');label.textContent=title;
    const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','收起'+title);close.onclick=()=>dialog.close();
    header.append(label,close);dialog.append(header);document.body.append(dialog);return dialog;
  }
  const details=sheet('compact-details','天体详情'), controls=sheet('compact-controls','探索与控制');
  const extra=document.createElement('div');extra.className='compact-extra';controls.append(extra);
  infoButton.onclick=()=>details.showModal();exploreButton.onclick=()=>controls.showModal();
  const placements=[];
  function move(selector,parent) {
    const node=document.querySelector(selector);if(!node)return;
    const marker=document.createComment('compact control location');node.before(marker);placements.push({node,marker});parent.append(node);
  }
  function updateName(){infoButton.textContent=(document.getElementById('info-name').firstChild?.textContent || '天体')+' · 详情 ⌃';}
  new MutationObserver(updateName).observe(document.getElementById('info-name'),{childList:true,characterData:true,subtree:true});updateName();
  function adapt() {
    details.close();controls.close();
    if(query.matches && !placements.length){
      move('#info-panel',details);
      for(const selector of ['.scenes','#earthsense-mode-switch','.control-row','.planet-dock','#trajectory-panel','#earthsense-panel','.zoom-controls']) move(selector,controls);
      for(const selector of ['.github-link','#fullscreen','#help-button','#credits-button']) move(selector,extra);
      controls.append(extra);
    }else if(!query.matches){
      for(const {node,marker} of placements){marker.replaceWith(node);}placements.length=0;
    }
    document.body.classList.toggle('compact-ui',query.matches);
    fitDetails();
  }
  controls.addEventListener('click',event=>{
    if(event.target.closest('.planet-button,[data-view],#overview,.trajectory-back,#night-view,#station-view,#jwst-visit'))controls.close();
  });
  details.addEventListener('click',event=>{if(event.target.closest('button:not(.compact-sheet-header button)'))details.close();});
  for(const dialog of [details,controls]) dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  query.addEventListener('change',adapt);adapt();
}
