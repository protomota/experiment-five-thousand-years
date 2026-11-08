import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {events as existing} from '../src/events.ts';
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const cache=root+'/cache/catalog';await mkdir(cache,{recursive:true});
const headers={'User-Agent':'FiveThousandYearsAtlas/1.0 (educational history atlas; source attribution retained)'};
async function get(url,key){
 const path=cache+'/'+key+'.json';try{return JSON.parse(await readFile(path,'utf8'));}catch{}
 for(let attempt=0;attempt<6;attempt++){
  await new Promise(resolve=>setTimeout(resolve,1800));
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});
  if(response.status===429||response.status>=500){console.log('Backing off',response.status,key);await new Promise(resolve=>setTimeout(resolve,Math.max(10000,Number(response.headers.get('retry-after')||0)*1000)*(attempt+1)));continue;}
  if(!response.ok)throw Error(response.status+' '+url);
  const data=await response.json();if(data.error)throw Error(JSON.stringify(data.error));await writeFile(path,JSON.stringify(data));return data;
 }
 throw Error('Request retry limit: '+key);
}
const seeds=(await readFile('scripts/catalog-seeds.txt','utf8')).split('\n').filter(line=>line&&!line.startsWith('#')).map(line=>{const [article,year,lat,lon,place,category]=line.split('|');return {article,year:Number(year),lat:Number(lat),lon:Number(lon),place,category,curated:true};});
const supplement=JSON.parse(await readFile(root+'/cache/wikidata-events.json','utf8'));
const caps={war:340,disaster:85,science:47,politics:56};
const extras=Object.entries(caps).flatMap(([category,count])=>supplement.filter(item=>item.category===category).sort((a,b)=>b.sitelinks-a.sitelinks).slice(0,count)).map(item=>({article:item.wiki,year:item.year,lat:item.lat,lon:item.lon,category:({war:'War & conflict',disaster:'Health & environment',science:'Discovery',politics:'Diplomacy & government'})[item.category],qid:item.id.replace('wd:',''),curated:false}));
const core=existing.filter(event=>!event.catalog),used=new Set(core.map(event=>event.article.replaceAll('_',' ').toLowerCase()));
const candidates=[...seeds,...extras].filter(item=>{const key=item.article.replaceAll('_',' ').toLowerCase();if(used.has(key))return false;used.add(key);return true;});
const pages=new Map();
for(let offset=0;offset<candidates.length;offset+=20){
 const chunk=candidates.slice(offset,offset+20),titles=chunk.map(item=>item.article.replaceAll('_',' '));
 const url='https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',redirects:'1',prop:'pageprops|pageimages',piprop:'thumbnail|original',pithumbsize:'640',titles:titles.join('|')});
 const data=await get(url,'pages-'+offset+'-'+candidates.length);
 const redirects=new Map((data.query.redirects||[]).map(item=>[item.from,item.to]));
 for(const candidate of chunk){let title=candidate.article.replaceAll('_',' ');for(let i=0;i<8&&redirects.has(title);i++)title=redirects.get(title);const page=Object.values(data.query.pages).find(page=>page.title===title);if(page&&!page.missing){pages.set(candidate.article,page);candidate.qid=page.pageprops?.wikibase_item||candidate.qid;}}
 console.log('Resolved article metadata',Math.min(offset+20,candidates.length),'/',candidates.length);
}
const ids=[...new Set(candidates.map(item=>item.qid).filter(Boolean))],entities={};
for(let offset=0;offset<ids.length;offset+=40){const chunk=ids.slice(offset,offset+40);const url='https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',format:'json',ids:chunk.join('|'),props:'labels|descriptions|claims',languages:'en'});Object.assign(entities,(await get(url,'entities-'+offset+'-'+ids.length)).entities);console.log('Loaded sourced facts',Math.min(offset+40,ids.length),'/',ids.length);}
const value=(entity,property)=>entity?.claims?.[property]?.find(claim=>claim.rank!=='deprecated'&&claim.mainsnak.datavalue)?.mainsnak.datavalue.value;
const relationIds=new Set();for(const entity of Object.values(entities))for(const property of ['P276','P17','P361']){const id=value(entity,property)?.id;if(id)relationIds.add(id);}
const relationLabels={};const relatives=[...relationIds];for(let offset=0;offset<relatives.length;offset+=50){const chunk=relatives.slice(offset,offset+50);const data=await get('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',format:'json',ids:chunk.join('|'),props:'labels',languages:'en'}),'labels-'+offset+'-'+relatives.length);for(const [id,entity] of Object.entries(data.entities))relationLabels[id]=entity.labels?.en?.value;}
const countries=JSON.parse(await readFile(root+'/cache/countries.geojson','utf8'));
function inside(x,y,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
function countryAt(lat,lon){return countries.features.find(feature=>(feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates).some(polygon=>inside(lon,lat,polygon[0])&&!polygon.slice(1).some(ring=>inside(lon,lat,ring))));}
const titleOverrides={Vasco_da_Gama:'A sea route from Europe reaches India',Zheng_He:'Zheng He’s treasure fleets set sail',High_Seas_Treaty:'The high seas treaty enters into force',Artemis_II:'Astronauts return to the Moon’s neighborhood',Human_Genome_Project:'The Human Genome Project is completed',Event_Horizon_Telescope:'The first image of a black hole',Paris_Agreement:'The Paris climate agreement is adopted',COVID_19_pandemic:'COVID-19 becomes a global pandemic'};
const approximate=new Set(['Renaissance','Enlightenment','Scientific_Revolution','Industrial_Revolution','Age_of_Discovery','Silk_Road','Great_Zimbabwe','Kingdom_of_Benin','Ghana_Empire','Srivijaya','Machu_Picchu','Ottoman_Empire']);
const manifest=JSON.parse(await readFile(root+'/assets/manifest.json','utf8'));
const result=[],seen=new Set(core.map(event=>event.article.replaceAll('_',' ').toLowerCase()));
for(const candidate of candidates){
 const page=pages.get(candidate.article),entity=entities[candidate.qid];if(!page||!entity)continue;
 const normalized=page.title.toLowerCase();if(seen.has(normalized))continue;seen.add(normalized);
 const description=entity.descriptions?.en?.value||'';
 if(!candidate.curated&&/mythological|legendary|fictional/.test(description))continue;
 let year=candidate.year;const date=value(entity,'P580')||value(entity,'P585');if(!candidate.curated&&date?.time){year=Number(date.time.match(/^([+-]?\d+)-/)[1]);}
 if(!candidate.curated){const namedYear=page.title.match(/^(\d{4})\b|\((\d{4})[–-]\d{4}\)/);if(namedYear)year=Number(namedYear[1]||namedYear[2]);if(candidate.qid==='Q15733401')year=2014;}
 if(!year||year< -3000||year>2026)continue;
 const country=countryAt(candidate.lat,candidate.lon),continent=country?.properties.CONTINENT;
 const region=continent==='North America'||continent==='South America'?'Americas':continent==='Seven seas (open ocean)'?'Oceania':continent||'Asia';
 const location=relationLabels[value(entity,'P276')?.id];const parent=relationLabels[value(entity,'P361')?.id];
 const id='event-'+candidate.qid.toLowerCase(),title=titleOverrides[candidate.article]||page.title;
 const body=description?description[0].toUpperCase()+description.slice(1).replace(/\.?$/,'.'):title+' is included in this atlas as a '+candidate.category.toLowerCase()+' milestone.';
 const place=candidate.place||location||country?.properties.ADMIN||'Representative location';
 const facts=[];if(parent&&parent!==title)facts.push({label:'Part of',value:parent});if(location&&location!==place)facts.push({label:'Associated place',value:location});
 const end=value(entity,'P582');if(end?.time){const endYear=Number(end.time.match(/^([+-]?\d+)-/)[1]);if(endYear!==year&&endYear<=2026)facts.push({label:'End year',value:String(endYear)});}
 const event={id,year,title,place,region,lat:candidate.lat,lon:candidate.lon,category:candidate.category,article:page.title.replaceAll(' ','_'),body,approximate:year<0||approximate.has(candidate.article),imageNote:page.thumbnail?'Historical image or associated place; see image credit':'No verified historical image available',catalog:true,qid:candidate.qid,facts,sources:[{title:'Wikidata structured record (CC0)',url:'https://www.wikidata.org/wiki/'+candidate.qid},{title:page.title+' — background and references',url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(page.title.replaceAll(' ','_'))}]};
 result.push(event);
 const original=page.original?.source;const file=original?decodeURIComponent(new URL(original).pathname.split('/').at(-1)):null;
 const saved=manifest[id]?.file===file?manifest[id]:null;
 manifest[id]={title:page.title,url:event.sources[1].url,image:saved?.image||null,remoteImage:page.thumbnail?.source||null,file,source:saved?.source||(file?'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file):null),metadata:saved?.metadata||{},catalog:true};
}
await writeFile(root+'/assets/catalog.json',JSON.stringify(result));await writeFile(root+'/assets/manifest.json',JSON.stringify(manifest,null,2));
await writeFile(root+'/cache/catalog-provenance.json',JSON.stringify({retrieved:'2026-11-08',source:'Wikidata CC0; article and image metadata from Wikipedia APIs',candidateIndex:'https://github.com/knalpas/chronoglobe/blob/master/src/data/wikidata-events.json',seedFile:'scripts/catalog-seeds.txt',count:result.length},null,2));
console.log('CATALOG READY',result.length,'new entries;',result.length+core.length,'total');
await import('./apply-catalog-notes.mjs');
