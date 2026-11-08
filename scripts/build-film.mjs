import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {mkdir,copyFile,symlink,readFile,writeFile,cp,unlink,readlink} from 'node:fs/promises';
import {filmPage} from './film-page.mjs';
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const out=`${root}/film`;await mkdir(`${out}/assets`,{recursive:true});
await copyFile('video/index.html',`${out}/index.html`);
for(const name of ['earth.jpg','cormorant-garamond-latin-400-normal.woff2','dm-sans-latin-400-normal.woff2'])await copyFile(`${root}/assets/${name}`,`${out}/assets/${name}`);
const manifest=JSON.parse(await readFile(`${root}/assets/manifest.json`,'utf8'));
for(const id of ['pyramids','angkor','apollo']){if(!manifest[id]?.image)throw new Error(`Missing film image ${id}`);await copyFile(`${root}/assets/${manifest[id].image}`,`${out}/assets/${id}.jpg`);}
await build({stdin:{contents:"export * as THREE from 'three'; export { gsap } from 'gsap'; export { OrbitControls } from 'three/addons/controls/OrbitControls.js';",resolveDir:process.cwd()},outfile:`${out}/assets/vendor.min.js`,bundle:true,format:'iife',globalName:'AtlasLibraries',minify:true,target:'es2022'});
await build({entryPoints:['src/film.ts'],outfile:`${out}/assets/film.js`,bundle:true,format:'iife',minify:false,target:'es2022',plugins:[{name:'local-vendor-globals',setup(plugin){plugin.onResolve({filter:/^(three|gsap)(\/.*)?$/},args=>({path:args.path,namespace:'atlas-library'}));plugin.onLoad({filter:/.*/,namespace:'atlas-library'},args=>({contents:args.path==='three'?'module.exports = window.AtlasLibraries.THREE;':args.path==='gsap'?'module.exports = {gsap: window.AtlasLibraries.gsap};':'module.exports = {OrbitControls: window.AtlasLibraries.OrbitControls};',loader:'js'}));}}]});
await writeFile(`${out}/ASSET-CREDITS.json`,JSON.stringify(Object.fromEntries(['pyramids','angkor','apollo'].map(id=>[id,manifest[id]])),null,2));
const site=`${root}/film-site`;await mkdir(site,{recursive:true});await writeFile(`${site}/index.html`,filmPage(await readFile(`${out}/index.html`,'utf8')));await cp(`${out}/assets`,`${site}/assets`,{recursive:true});await copyFile(`${out}/ASSET-CREDITS.json`,`${site}/ASSET-CREDITS.json`);
try{const current=await readlink('public/film');if(current!==site)await unlink('public/film');}catch(error){if(error.code!=='ENOENT')throw error;}
try{await symlink(site,'public/film');}catch(error){if(error.code!=='EEXIST')throw error;}
console.log('Built HyperFrames composition:',out);
