import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const cache=root+'/cache/briefs';await mkdir(cache,{recursive:true});
const events=JSON.parse(await readFile(root+'/assets/catalog.json','utf8'));
let briefs={};try{briefs=JSON.parse(await readFile(root+'/assets/briefs.json','utf8'));}catch{}
const pending=events.filter(event=>!event.editorial&&!briefs[event.id]);
const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});
const words=text=>text.trim().split(/\s+/).length;
function brief(extract){
 const text=extract.replace(/\([^)]*(?:IPA|pronounced|pronunciation|German:|French:|Dutch:|Arabic:|Russian:|Chinese:|Japanese:|Latin:)[^)]*\)/g,'').replace(/\[[a-z]\]/g,'').replace(/\s+/g,' ').trim();
 const sentences=[...segmenter.segment(text)].map(item=>item.segment.trim()).filter(sentence=>/[.!?][”’"']?$/.test(sentence)&&!/(?:\.\.\.|…)\s*$/.test(sentence));
 const result=[];
 for(const sentence of sentences){
  if(result.length>=2&&words([...result,sentence].join(' '))>150)break;
  result.push(sentence);
  if(result.length>=3&&words(result.join(' '))>=75)break;
 }
 return result.join(' ');
}
async function get(titles){
 const params=new URLSearchParams({action:'query',format:'json',prop:'extracts|info',inprop:'url',exintro:'1',explaintext:'1',exlimit:'max',exchars:'1200',titles:titles.join('|'),redirects:'1'});
 const path=cache+'/'+createHash('sha256').update(params.toString()).digest('hex')+'.json';
 try{return JSON.parse(await readFile(path,'utf8'));}catch{}
 for(let attempt=0;attempt<4;attempt++){
  await new Promise(resolve=>setTimeout(resolve,1800));
  const response=await fetch('https://en.wikipedia.org/w/api.php?'+params,{headers:{'User-Agent':'FiveThousandYearsAtlas/1.0 (educational atlas; CC BY-SA source attribution retained)'},signal:AbortSignal.timeout(45000)});
  if(response.status===429||response.status>=500){await new Promise(resolve=>setTimeout(resolve,Math.min(30000,Math.max(5000,Number(response.headers.get('retry-after')||0)*1000))));continue;}
  if(!response.ok)throw Error('Wikipedia response '+response.status);
  const data=await response.json();if(data.error)throw Error(JSON.stringify(data.error));await writeFile(path,JSON.stringify(data));return data;
 }
 throw Error('Could not retrieve source extracts');
}
for(let offset=0;offset<pending.length;offset+=20){
 const batch=pending.slice(offset,offset+20),data=await get(batch.map(event=>event.article.replaceAll('_',' ')));
 const redirects=new Map([...(data.query.normalized||[]),...(data.query.redirects||[])].map(item=>[item.from,item.to]));
 for(const event of batch){
  let title=event.article.replaceAll('_',' ');for(let i=0;i<8&&redirects.has(title);i++)title=redirects.get(title);
  const page=Object.values(data.query.pages).find(page=>page.title===title);if(!page?.extract)continue;
  const body=brief(page.extract);if(words(body)<40)continue;
  briefs[event.id]={body,briefSource:{title:page.title,url:page.canonicalurl,revision:page.lastrevid,license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',note:'Shortened from the article introduction; formatting and pronunciation annotations may be removed.'}};
 }
 await writeFile(root+'/assets/briefs.json',JSON.stringify(briefs));
 console.log('Expanded',Math.min(offset+20,pending.length),'of',pending.length,'candidates;',Object.keys(briefs).length,'paragraph briefs saved');
}
console.log('Needs editorial follow-up:',events.filter(event=>!event.editorial&&!briefs[event.id]).map(event=>({id:event.id,title:event.title,body:event.body})));
await import('./apply-catalog-notes.mjs');
