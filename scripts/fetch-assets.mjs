import {fileURLToPath} from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { events } from '../src/events.ts';
const root=`${process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url))}/assets`;
await mkdir(root,{recursive:true});
const headers={'User-Agent':'FiveThousandYearsAtlas/1.0 (educational history prototype; source attribution included)'};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function get(url){for(let attempt=0;attempt<5;attempt++){const r=await fetch(url,{headers,signal:AbortSignal.timeout(35000)});if(r.ok)return r;if(r.status===429){console.log('Rate limit; backing off',attempt+1);await wait(Math.max(6000,Number(r.headers.get('retry-after')||0)*1000)*(attempt+1));continue;}throw new Error(`${r.status} ${url}`);}throw new Error(`Rate limit exhausted: ${url}`);}
async function download(url,name){const bytes=Buffer.from(await (await get(url)).arrayBuffer());await writeFile(`${root}/${name}`,bytes);return name;}
const manifest={};
try{Object.assign(manifest,JSON.parse(await readFile(`${root}/manifest.json`,'utf8')));}catch{}
for(const event of events){
 if(manifest[event.id]?.image)continue;
 try{
  const data=await (await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${event.article}`)).json();
  const originalPath=data.originalimage?new URL(data.originalimage.source).pathname:null;
  const file=originalPath?decodeURIComponent(originalPath.includes('/thumb/')?originalPath.split('/').at(-2):originalPath.split('/').pop()):null;
  const credit=file?{file,source:`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`}:{ };
  const imageUrl=data.thumbnail?.source?.replace(/\/\d+px-/,'/960px-');
  const image=imageUrl?await download(imageUrl,`${event.id}.${new URL(imageUrl).pathname.split('.').pop()}`):null;
  manifest[event.id]={title:data.title,url:data.content_urls.desktop.page,extract:data.extract,image,imageUrl,...credit};
  await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2));
  console.log(event.id,image?'image + source':'SOURCE ONLY');await wait(2200);
 }catch(error){console.error(event.id,error.message);}
}
for(const asset of Object.values(manifest)){if(asset.file&&!asset.metadata&&asset.imageUrl){const pathname=new URL(asset.imageUrl).pathname;if(pathname.includes('/thumb/')){asset.file=decodeURIComponent(pathname.split('/').at(-2));asset.source=`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(asset.file)}`;}}}
const pending=Object.values(manifest).filter(asset=>asset.file&&!asset.metadata);
for(let offset=0;offset<pending.length;offset+=25){try{const chunk=pending.slice(offset,offset+25);await wait(3000);const data=await(await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&titles=${encodeURIComponent(chunk.map(asset=>'File:'+asset.file).join('|'))}`)).json();for(const page of Object.values(data.query.pages)){const info=page.imageinfo?.[0];const asset=chunk.find(asset=>'File:'+asset.file.replaceAll('_',' ')===page.title);if(asset&&info){asset.source=info.descriptionurl;asset.metadata=info.extmetadata;}}}catch(error){console.error('Credits:',error.message);}}
await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2));
await download('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg','earth.jpg');
await download('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=BlueMarble_ShadedRelief_Bathymetry&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=4096&HEIGHT=2048&FORMAT=image/jpeg&STYLES=','earth-relief.jpg');
for(const [family,file] of [['cormorant-garamond','cormorant-garamond-latin-400-normal.woff2'],['dm-sans','dm-sans-latin-400-normal.woff2']])await download(`https://cdn.jsdelivr.net/fontsource/fonts/${family}@latest/latin-400-normal.woff2`,file);
console.log('Assets complete:',Object.keys(manifest).length,'milestones.');
