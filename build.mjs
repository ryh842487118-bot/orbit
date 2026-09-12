import { readFile,writeFile } from 'node:fs/promises';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const result=await esbuild.build({entryPoints:[path.join(root,'src/universe.js')],bundle:true,format:'iife',minify:true,target:'es2020',write:false,legalComments:'inline'});
const names=['earth-day','earth-night','earth-clouds','moon','mercury','venus-atmosphere','mars','jupiter','saturn','saturn-rings','uranus','neptune','sun','earth-day-8k','earth-night-8k'];
const assets={};for(const name of names){const ext=name==='saturn-rings'?'png':'jpg';assets[name]=`data:image/${ext==='jpg'?'jpeg':'png'};base64,${(await readFile(path.join(root,'assets',name+'.'+ext))).toString('base64')}`;}
const [shell,...styles]=await Promise.all(['src/shell.html','src/style.css','src/ui/earthsense.css','src/ui/trajectory.css','src/ui/compact.css','src/ui/jwst.css'].map(file=>readFile(path.join(root,file),'utf8')));
const css=styles.join('\n');
const html=shell.replace('/* INLINE_CSS */',()=>css).replace('/* INLINE_ASSETS */',()=>`window.ORBIT_ASSETS=${JSON.stringify(assets)};`).replace('/* INLINE_JS */',()=>result.outputFiles[0].text.replaceAll('</script','<\/script'));
await writeFile(path.join(root,'index.html'),html);
console.log(`Built self-contained HTML: ${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MB; ${names.length} embedded textures; Three.js r185.`);
