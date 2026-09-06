import { readFile,writeFile } from 'node:fs/promises';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const result=await esbuild.build({entryPoints:[path.join(root,'src/universe.js')],bundle:true,format:'iife',minify:true,target:'es2020',write:false,legalComments:'inline'});
const names=['earth-day','earth-night','earth-clouds','moon','mercury','venus-atmosphere','mars','jupiter','saturn','saturn-rings','uranus','neptune','sun'];
const assets={};for(const name of names){const ext=name==='saturn-rings'?'png':'jpg';assets[name]=`data:image/${ext==='jpg'?'jpeg':'png'};base64,${(await readFile(path.join(root,'assets',name+'.'+ext))).toString('base64')}`;}
const [shell,css]=await Promise.all([readFile(path.join(root,'src/shell.html'),'utf8'),readFile(path.join(root,'src/style.css'),'utf8')]);
const html=shell.replace('/* INLINE_CSS */',()=>css).replace('/* INLINE_ASSETS */',()=>`window.ORBIT_ASSETS=${JSON.stringify(assets)};`).replace('/* INLINE_JS */',()=>result.outputFiles[0].text.replaceAll('</script','<\/script'));
await writeFile(path.join(root,'index.html'),html);
console.log(`Built self-contained HTML: ${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MB; ${names.length} embedded textures; Three.js r185.`);
