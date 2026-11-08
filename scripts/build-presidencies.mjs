import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const cache=root+'/cache/presidents';await mkdir(cache,{recursive:true});
const seeds=JSON.parse(await readFile('scripts/presidency-seeds.json','utf8'));
const headers={'User-Agent':'FiveThousandYearsAtlas/1.0 (https://five-thousand-years.ngrok.app/; educational history atlas)'};
async function get(url){
 for(let attempt=0;attempt<6;attempt++){
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});
  if(response.ok)return response;
  if(response.status===429||response.status>=500){await new Promise(resolve=>setTimeout(resolve,Math.max(5000*2**Math.min(attempt,3),Number(response.headers.get('retry-after')||0)*1000)));continue;}
  throw Error(response.status+' '+url);
 }
 throw Error('Source unavailable '+url);
}
async function json(url){const path=cache+'/'+createHash('sha256').update(url).digest('hex')+'.json';try{return JSON.parse(await readFile(path,'utf8'));}catch{}const data=await(await get(url)).json();if(data.error)throw Error(JSON.stringify(data.error));await writeFile(path,JSON.stringify(data));return data;}
const wiki=params=>'https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',...params});
const names=[...new Set(seeds.map(row=>row[0]))],pages=[];
for(let offset=0;offset<names.length;offset+=15){const data=await json(wiki({prop:'pageimages|pageprops|extracts|info',inprop:'url',piprop:'thumbnail|name|original',pithumbsize:'960',exintro:'1',explaintext:'1',exlimit:'max',titles:names.slice(offset,offset+15).join('|'),redirects:'1'}));pages.push(...Object.values(data.query.pages));}
const entities=(await json('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',format:'json',ids:pages.map(page=>page.pageprops.wikibase_item).join('|'),props:'claims|labels',languages:'en'}))).entities;
const claim=(entity,property)=>(entity.claims[property]||[]).filter(c=>c.rank!=='deprecated'&&c.mainsnak.datavalue).sort((a,b)=>(b.rank==='preferred')-(a.rank==='preferred'))[0]?.mainsnak.datavalue.value;
const placeIds=[...new Set(Object.values(entities).map(entity=>claim(entity,'P19')?.id).filter(Boolean))];
const places=(await json('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',format:'json',ids:placeIds.join('|'),props:'claims|labels|sitelinks',languages:'en',sitefilter:'enwiki'}))).entities;
// Resolve containing places so a hospital or memorial is not shown without a city/state.
for(let depth=0;depth<5;depth++){
 const missing=[...new Set(Object.values(places).map(entity=>claim(entity,'P131')?.id).filter(id=>id&&!places[id]))];
 if(!missing.length)break;
 for(let offset=0;offset<missing.length;offset+=50){const data=await json('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',format:'json',ids:missing.slice(offset,offset+50).join('|'),props:'claims|labels',languages:'en'}));Object.assign(places,data.entities);}
}
const stateNames=new Set(['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming']);
function birthLocation(id){const labels=[];const seen=new Set();while(id&&!seen.has(id)&&labels.length<7){seen.add(id);const place=places[id];if(!place)break;const label=place.labels?.en?.value||place.sitelinks?.enwiki?.title;if(label)labels.push(label);if(stateNames.has(label)&&labels.length>1)break;id=claim(place,'P131')?.id;}const state=labels.find((label,index)=>index>0&&stateNames.has(label));return [...new Set([labels[0],labels[1],state].filter(Boolean))].join(' · ')||'See biography';}
const images=new Map();
for(let offset=0;offset<pages.length;offset+=20){
 const data=await json('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'extmetadata|url',iiurlwidth:'960',titles:pages.slice(offset,offset+20).map(page=>'File:'+page.pageimage).join('|')}));
 for(const page of Object.values(data.query.pages))if(page.imageinfo?.[0])images.set(page.title.replaceAll('_',' '),page.imageinfo[0]);
}
const date=value=>new Date(value+'T00:00:00Z').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
const cutoff='2026-11-08';
function duration(start,end){const a=new Date(start+'T00:00:00Z'),b=new Date((end||cutoff)+'T00:00:00Z');let years=b.getUTCFullYear()-a.getUTCFullYear(),months=b.getUTCMonth()-a.getUTCMonth();if(b.getUTCDate()<a.getUTCDate())months--;if(months<0){years--;months+=12;}const days=Math.floor((b-a)/86400000);return [years?years+' '+(years===1?'year':'years'):null,months?months+' '+(months===1?'month':'months'):null].filter(Boolean).join(', ')+(years||months?` (${days.toLocaleString('en-US')} days)`:`${days} days`)+(end?'':' · ongoing as of November 8, 2026');}
function brief(extract){const paragraphs=[];for(const text of extract.split(/\n+/)){const paragraph=text.replace(/\s+/g,' ').trim();if(!paragraph)continue;paragraphs.push(paragraph);if(paragraphs.join(' ').split(/\s+/).length>=60)break;}return paragraphs.join(' ');}
const manifest=JSON.parse(await readFile(root+'/assets/manifest.json','utf8'));
const output=[];
for(const [index,[name,start,end,party]] of seeds.entries()){
 const ordinal=index+1,id='president-'+String(ordinal).padStart(2,'0');
 const page=pages.find(page=>page.title===name);if(!page)throw Error('Missing biography '+name);
 const qid=page.pageprops.wikibase_item,entity=entities[qid];
 const birth=claim(entity,'P569'),death=claim(entity,'P570'),placeId=claim(entity,'P19')?.id;
 if(!birth||birth.precision<11)throw Error('Missing precise birth date '+name);
 const calendarDate=value=>{
  if(!value)return null;
  const raw=value.time.slice(1,11);
  if(value.calendarmodel.endsWith('Q1985727'))return raw;
  if(!value.calendarmodel.endsWith('Q1985786'))throw Error('Unknown calendar '+name);
  const parsed=new Date(raw+'T00:00:00Z'),year=parsed.getUTCFullYear()-(parsed.getUTCMonth()<2?1:0);
  parsed.setUTCDate(parsed.getUTCDate()+Math.floor(year/100)-Math.floor(year/400)-2);
  return parsed.toISOString().slice(0,10);
 };
 const born=calendarDate(birth),died=calendarDate(death);
 const birthplace=name==='Andrew Jackson'?'Waxhaws, North Carolina–South Carolina border region (exact site disputed)':birthLocation(placeId);
 const article=page.title.replaceAll(' ','_');
 const term=date(start)+' – '+(end?date(end):'Present');
 const first=[22,45].includes(ordinal),second=[24,47].includes(ordinal);
 const title=name+(first?' · first presidency':second?' · second presidency':' becomes president');
 const body=(second?`${name} returned to the presidency for a second, nonconsecutive period in office. `:'')+brief(page.extract);
 const facts=[{label:'President',value:`No. ${ordinal} · ${name}`},{label:'Born',value:date(born)},{label:'Birthplace',value:birthplace},{label:'In office',value:term},{label:'Time served in this presidency',value:duration(start,end)},{label:'Political affiliation',value:party},{label:died?'Died':'Status',value:died?date(died):'Living as of November 8, 2026'}];
 const presidency={ordinal,name,born,died,birthplace,start,end,party};
 const city=ordinal===1?{place:'New York City · first presidential inauguration',lat:40.7074,lon:-74.0104}:ordinal===2?{place:'Philadelphia · national capital at accession',lat:39.9489,lon:-75.1500}:{place:'Washington, DC · seat of the U.S. presidency',lat:38.8977,lon:-77.0365};
 output.push({id,year:Number(start.slice(0,4)),date:start,title,...city,region:'Americas',category:'Presidencies',article,body,imageNote:'Historical portrait; image credit and license in Sources',catalog:true,qid,presidency,facts,sources:[{title:'National Archives: presidents and dates in office',url:'https://www.archives.gov/research/census/presidents'},{title:'National Archives: early presidential terms and parties',url:'https://www.archives.gov/presidential-records/research/additional-research-resources'},{title:'Biographical data and references on Wikidata',url:'https://www.wikidata.org/wiki/'+qid}],briefSource:{title:page.title,url:page.canonicalurl,revision:page.lastrevid,license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',note:'Selected introductory sentences. Nonconsecutive term context may be added; formatting is condensed.'}});
 const image=images.get(('File:'+page.pageimage).replaceAll('_',' '));if(!image?.extmetadata?.LicenseShortName)throw Error('Unverified portrait license '+name);
 const filename='portrait-'+qid.toLowerCase()+'.webp';
 if(!await stat(root+'/assets/'+filename).catch(()=>null)){
  const response=await get(image.thumburl||page.thumbnail?.source||image.url);
  const bytes=Buffer.from(await response.arrayBuffer());await sharp(bytes).resize({width:960,withoutEnlargement:true}).webp({quality:85}).toFile(root+'/assets/'+filename);
 }
 manifest[id]={image:filename,title:name+' — portrait',url:page.canonicalurl,file:page.pageimage,source:image.descriptionurl,metadata:image.extmetadata,catalog:true};
 console.log('Prepared',ordinal,name);
}
await writeFile(root+'/assets/presidencies.json',JSON.stringify(output));
await writeFile(root+'/assets/manifest.json',JSON.stringify(manifest,null,2));
console.log('Saved',output.length,'presidencies with',new Set(output.map(event=>event.qid)).size,'licensed portraits');
