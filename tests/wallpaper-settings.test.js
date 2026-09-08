import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWallpaperSettings, wallpaperFrame, nextWallpaperBody, nextTrajectoryPreset, WALLPAPER_DEFAULTS } from '../src/ui/wallpaper-settings.js';

test('wallpaper settings reject invalid persisted values and bound size and autoplay interval', () => {
  assert.deepEqual(normalizeWallpaperSettings({center:'elsewhere',screen:'unknown',single:'false',interval:0,zoom:300}), {
    ...WALLPAPER_DEFAULTS, interval:5,zoom:300,
  });
  assert.deepEqual(normalizeWallpaperSettings(null), WALLPAPER_DEFAULTS);
  assert.equal(normalizeWallpaperSettings({single:true}).mode,'focus');
  assert.equal(normalizeWallpaperSettings({single:true,mode:'trajectory'}).mode,'trajectory');
  const settings=normalizeWallpaperSettings({spaceColor:'#AC12FE',trajectoryCenter:'elsewhere',trajectoryDragPitch:100});
  assert.equal(settings.spaceColor,'#ac12fe'); assert.equal(settings.trajectoryCenter,'middle'); assert.equal(settings.trajectoryDragPitch,85);
  assert.equal(normalizeWallpaperSettings({spaceColor:'url(bad)'}).spaceColor,WALLPAPER_DEFAULTS.spaceColor);
});
test('obsolete manual screen and trajectory layout settings are discarded', () => {
  const migrated=normalizeWallpaperSettings({screen:'watch-round',size:35,trajectoryX:85,trajectoryY:15,trajectoryYaw:90,trajectoryRoll:180});
  assert.deepEqual(migrated,WALLPAPER_DEFAULTS);
  for(const [width,height] of [[200,200],[320,844],[844,320],[1440,900]]) {
    assert.deepEqual(wallpaperFrame(width,height),{width,height});
  }
});
test('manual switching and carousel wrap at both ends',()=>{
  assert.equal(nextWallpaperBody(['earth','moon','saturn'],'saturn',1),'earth');
  assert.equal(nextWallpaperBody(['earth','moon','saturn'],'earth',-1),'saturn');
  assert.equal(nextWallpaperBody([],'earth',1),null);
});

test('all screen preferences survive serialization without losing mode or orientation',()=>{
  const saved={...WALLPAPER_DEFAULTS,mode:'trajectory',selected:'andromeda',spaceColor:'#190c24',trajectoryCenter:'right',trajectoryDragYaw:48,trajectoryDragPitch:27,focusYaw:-37,autoplay:true};
  assert.deepEqual(normalizeWallpaperSettings(JSON.parse(JSON.stringify(saved))),saved);
});

test('trajectory triple-tap cycles every frame and length combination',()=>{
  let settings={reference:'galactic',trail:'long'};
  const seen=[];
  for(let i=0;i<4;i++){settings=nextTrajectoryPreset(settings.reference,settings.trail);seen.push(settings);}
  assert.deepEqual(seen,[{reference:'galactic',trail:'short'},{reference:'solar',trail:'long'},{reference:'solar',trail:'short'},{reference:'galactic',trail:'long'}]);
  const saved=normalizeWallpaperSettings({starsVisible:false,orbitsVisible:false});
  assert.equal(saved.starsVisible,false);assert.equal(saved.orbitsVisible,false);
});

test('portrait zoom preserves magnification beyond the old framing limit and bounds corrupt values',()=>{
  assert.equal(normalizeWallpaperSettings({zoom:1200}).zoom,1200);
  assert.equal(normalizeWallpaperSettings({zoom:999999}).zoom,5000);
  assert.equal(normalizeWallpaperSettings({zoom:-10}).zoom,5);
});
