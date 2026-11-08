import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,readdir,copyFile,cp,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {filmPage} from './film-page.mjs';

const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const require=createRequire(`${root}/publish-tools/package.json`);
const sharp=require('sharp');
const release=process.argv[2];
if(!release||!/^[a-z0-9-]+$/.test(release))throw Error('Usage: node scripts/prepare-release.mjs <unique-release-id>');
const out=`${root}/releases/${release}`;
if(await stat(out).catch(()=>null))throw Error('Use a new release ID; existing releases are immutable.');
const cdn=`https://media.protomota.com/five-thousand-years/releases/${release}`;
const assets=`${out}/r2/assets`;
await mkdir(`${assets}/images`,{recursive:true});
const manifest=JSON.parse(await readFile(`${root}/assets/manifest.json`,'utf8'));
const imageCache=new Map();
let localImages=0,remoteImages=0,placeholders=0,sourceImageBytes=0;
for(const asset of Object.values(manifest)){
 if(!asset.image){if(asset.remoteImage)remoteImages++;else placeholders++;continue;}
 localImages++;
 if(!imageCache.has(asset.image)){
  const bytes=await readFile(`${root}/assets/${asset.image}`);
  const webp=await sharp(bytes).rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer();
  const name=`images/${createHash('sha256').update(webp).digest('hex').slice(0,24)}.webp`;
  await writeFile(`${assets}/${name}`,webp);imageCache.set(asset.image,name);
  sourceImageBytes+=bytes.length;
 }
 asset.image=imageCache.get(asset.image);
}
await writeFile(`${assets}/manifest.json`,JSON.stringify(manifest));
for(const folder of ['reading','areas']){
 await mkdir(`${assets}/${folder}`,{recursive:true});
 for(const file of await readdir(`${root}/assets/${folder}`)){
  if(!file.endsWith('.json'))continue;
  await writeFile(`${assets}/${folder}/${file}`,JSON.stringify(JSON.parse(await readFile(`${root}/assets/${folder}/${file}`,'utf8'))));
 }
}
for(const file of ['catalog.json','presidencies.json','politics.json','briefs.json'])await writeFile(`${assets}/${file}`,JSON.stringify(JSON.parse(await readFile(`${root}/assets/${file}`,'utf8'))));
for(const file of ['earth.jpg','earth-relief.jpg','cormorant-garamond-latin-400-normal.woff2','dm-sans-latin-400-normal.woff2'])await copyFile(`${root}/assets/${file}`,`${assets}/${file}`);
await sharp(`${root}/atlas-card.png`).resize(1600,1000,{fit:'cover'}).webp({quality:88}).toFile(`${assets}/atlas-card.webp`);
await cp(`${root}/film-site/assets`,`${out}/r2/film/assets`,{recursive:true});
await copyFile(`${root}/film-site/ASSET-CREDITS.json`,`${out}/r2/film/ASSET-CREDITS.json`);
execFileSync('npm',['run','build'],{stdio:'inherit',env:{...process.env,ATLAS_CDN_BASE:cdn,ATLAS_PAGE_BASE:'/experiments/five-thousand-years/',ATLAS_OUTPUT_DIR:`${out}/build`,TMPDIR:`${root}/tmp`}});
await cp(`${out}/build/assets`,`${out}/r2/app/assets`,{recursive:true});
await mkdir(`${out}/site/film`,{recursive:true});
await copyFile(`${out}/build/index.html`,`${out}/site/index.html`);
const filmHtml=filmPage(await readFile(`${root}/film-site/index.html`,'utf8'),`${cdn}/film/`);
await writeFile(`${out}/site/film/index.html`,filmHtml);
const objects=[];
async function walk(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const name=path.posix.join(prefix,entry.name),file=path.join(dir,entry.name);
  if(entry.isDirectory()){await walk(file,name);continue;}
  const decoded=await readFile(file),encoding=/\.(json|js|css)$/.test(name)?'gzip':undefined;
  const bytes=encoding?gzipSync(decoded,{level:9}):decoded;
  if(encoding)await writeFile(file,bytes);
  objects.push({key:name,bytes:bytes.length,decodedBytes:decoded.length,encoding,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
}
await walk(`${out}/r2`);
const report={release,cdn,createdAt:new Date().toISOString(),milestones:Object.keys(manifest).length,localImages,uniqueImages:new Set(imageCache.values()).size,remoteImages,placeholders,sourceImageBytes,webpBytes:objects.filter(file=>file.key.startsWith('assets/images/')).reduce((sum,file)=>sum+file.bytes,0),totalBytes:objects.reduce((sum,file)=>sum+file.bytes,0),objects};
await writeFile(`${out}/release.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,objects:objects.length},null,2));
