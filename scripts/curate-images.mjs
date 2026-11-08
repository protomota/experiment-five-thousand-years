import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
const root=`${process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url))}/assets`;
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const picks={india:'A refugee train, Punjab, 1947.jpg',ghana:'Kwame Nkrumah (JFKWHP-AR6409-A).jpg',industrial:'StocktonDarlingtonOpening.jpg',un:'UnitedNationsconference.jpg',web:'NeXTcube first webserver.JPG'};
for(const [id,file] of Object.entries(picks)){
 const url=`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=960&titles=${encodeURIComponent('File:'+file)}`;
 const response=await fetch(url);if(!response.ok)throw new Error(`Metadata ${response.status}`);const data=await response.json();const info=Object.values(data.query.pages)[0].imageinfo?.[0];if(!info)throw new Error('Missing image '+file);
 const imageUrl=info.thumburl||info.url;const imageResponse=await fetch(imageUrl);if(!imageResponse.ok)throw new Error(`Image ${imageResponse.status}`);const image=`${id}-curated.jpg`;await writeFile(`${root}/${image}`,Buffer.from(await imageResponse.arrayBuffer()));
 manifest[id]={...manifest[id],image,imageUrl,file,source:info.descriptionurl,metadata:info.extmetadata};console.log('Curated:',id);
 await new Promise(resolve=>setTimeout(resolve,2500));
}
await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2));
