import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const manifest=JSON.parse(await readFile(`${root}/assets/manifest.json`,'utf8'));
const layers=[];let index=0;
for(const [id,asset] of Object.entries(manifest)){if(!asset.image)continue;const image=await sharp(`${root}/assets/${asset.image}`).resize(195,120,{fit:'contain',background:'#121b2b'}).jpeg().toBuffer();const left=(index%6)*210,top=Math.floor(index/6)*150;layers.push({input:image,left,top});layers.push({input:Buffer.from(`<svg width="195" height="30"><text x="5" y="20" font-size="14" fill="white">${id}</text></svg>`),left,top:top+120});index++;}
await sharp({create:{width:1260,height:Math.ceil(index/6)*150,channels:3,background:'#080f1c'}}).composite(layers).jpeg({quality:85}).toFile(`${root}/qa/asset-contact-sheet.jpg`);
console.log('Created asset review sheet.');
