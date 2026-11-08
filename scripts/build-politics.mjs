import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const cache=root+'/cache/politics';await mkdir(cache,{recursive:true});
const seeds=JSON.parse(await readFile('scripts/politics-seeds.json','utf8'));
const manifest=JSON.parse(await readFile(root+'/assets/manifest.json','utf8'));
const headers={'User-Agent':'FiveThousandYearsAtlas/1.0 (https://five-thousand-years.ngrok.app/; educational history atlas)'};
async function get(url){for(let attempt=0;attempt<7;attempt++){const response=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});if(response.ok)return response;if(response.status===429||response.status>=500){await new Promise(resolve=>setTimeout(resolve,Math.max(5000*2**Math.min(attempt,3),Number(response.headers.get('retry-after')||0)*1000)));continue;}throw Error(response.status+' '+url);}throw Error('Source unavailable '+url);}
async function json(url){const path=cache+'/'+createHash('sha256').update(url).digest('hex')+'.json';try{return JSON.parse(await readFile(path,'utf8'));}catch{}const data=await(await get(url)).json();if(data.error)throw Error(JSON.stringify(data.error));await writeFile(path,JSON.stringify(data));return data;}
const wiki=params=>'https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',...params});
function brief(extract){const paragraphs=[];for(const text of extract.split(/\n+/)){const paragraph=text.replace(/\s+/g,' ').trim();if(!paragraph)continue;paragraphs.push(paragraph);if(paragraphs.join(' ').split(/\s+/).length>=60)break;}return paragraphs.join(' ');}
const ap='https://www.ap.org/the-definitive-source/behind-the-news/calling-control-of-congress-in-the-2026-midterm-elections/';
const output=[];
for(const [year,title,article,president] of seeds){
 const response=await json(wiki({prop:'pageimages|pageprops|extracts|info',inprop:'url',piprop:'thumbnail|name|original',pithumbsize:'960',exintro:'1',explaintext:'1',titles:article,redirects:'1'}));
 const page=Object.values(response.query.pages)[0];if(!page.extract||!page.pageprops?.wikibase_item)throw Error('Missing political source '+article);
 const id='politics-'+page.pageprops.wikibase_item.toLowerCase();
 const election=article.includes('presidential_election');
 const dates={1860:'1860-11-06',1932:'1932-11-08',1960:'1960-11-08',1980:'1980-11-04',2000:'2000-11-07',2008:'2008-11-04',2016:'2016-11-08',2020:'2020-11-03',2024:'2024-11-05',2026:'2026-11-03'};
 const date=election||year===2026?dates[year]:article==='January_6_United_States_Capitol_attack'?'2021-01-06':undefined;
 const sources=[{title:election?'National Archives: official electoral results':'Wikidata: historical record and references',url:election?'https://www.archives.gov/electoral-college/'+year:'https://www.wikidata.org/wiki/'+page.pageprops.wikibase_item},{title:'Background and references',url:page.canonicalurl}];
 if(year===2026)sources.unshift({title:'Associated Press: calls for control of Congress',url:ap},{title:'Twentieth Amendment: congressional terms begin January 3',url:'https://www.archives.gov/founding-docs/amendments-11-27#xx'});
 const movement=['NAACP','Tea_Party_movement','Occupy_Wall_Street','Black_Lives_Matter','Nineteenth_Amendment_to_the_United_States_Constitution'].includes(article);
 let location={place:'Washington, DC · representative seat of national government',lat:38.8899,lon:-77.0091};
 if(article==='Occupy_Wall_Street')location={place:'Zuccotti Park, New York City',lat:40.7092,lon:-74.0113};
 if(article==='NAACP')location={place:'New York City · founding of the NAACP',lat:40.7128,lon:-74.006};
 if(article==='Black_Lives_Matter')location={place:'Oakland, California · one center of a decentralized movement',lat:37.8044,lon:-122.2712};
 if(article==='Republican_Party_(United_States)')location={place:'Ripon, Wisconsin · an early Republican organizing meeting',lat:43.8422,lon:-88.8359};
 const body=year===2026?'Democrats won majorities in both chambers in the November 3, 2026 U.S. midterm elections. The Associated Press called Senate control on election night and House control early the following morning. The outcome sets up a change in congressional control when the newly elected Congress takes office in January 2027; it does not mean that control had already changed on election night.':brief(page.extract);
 output.push({id,year,...(date?{date}:{}),title,...location,region:'Americas',category:movement?'Rights & society':'Diplomacy & government',article,body,catalog:true,qid:page.pageprops.wikibase_item,imageNote:president?'Portrait of the election winner or associated president':'Historical image or associated place; see image credit',sources,...(year===2026?{editorial:true}:{briefSource:{title:page.title,url:page.canonicalurl,revision:page.lastrevid,license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',note:'Selected introductory sentences; formatting condensed.'}})});
 if(president){manifest[id]={...manifest['president-'+String(president).padStart(2,'0')]};}
 else{
  // The Capitol represents the national 2026 election, rather than an incomplete results map.
  let imagePage=page;
  if(year===2026){const response=await json(wiki({prop:'pageimages',piprop:'name|thumbnail',pithumbsize:'960',titles:'United_States_Capitol'}));imagePage=Object.values(response.query.pages)[0];}
  if(!imagePage.pageimage){const fallback=article==='NAACP'?'W._E._B._Du_Bois':article==='Tea_Party_movement'?'Taxpayer_March_on_Washington':null;if(!fallback)throw Error('Missing image '+article);const response=await json(wiki({prop:'pageimages',piprop:'name|thumbnail',pithumbsize:'960',titles:fallback,redirects:'1'}));imagePage=Object.values(response.query.pages)[0];output.at(-1).imageNote=article==='NAACP'?'W. E. B. Du Bois, a co-founder of the NAACP':'Associated movement photograph; see image credit';if(!imagePage.pageimage)throw Error('Missing representative image '+fallback);}
  const response=await json('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'extmetadata|url',iiurlwidth:'960',titles:'File:'+imagePage.pageimage}));
  const image=Object.values(response.query.pages)[0].imageinfo?.[0];if(!image?.extmetadata?.LicenseShortName)throw Error('Unverified image license '+article);
  const filename=id+'.webp';
  if(!await stat(root+'/assets/'+filename).catch(()=>null)){const bytes=Buffer.from(await(await get(image.thumburl||image.url)).arrayBuffer());await sharp(bytes).resize({width:960,withoutEnlargement:true}).webp({quality:85}).toFile(root+'/assets/'+filename);}
  manifest[id]={image:filename,title:imagePage.pageimage,url:page.canonicalurl,file:imagePage.pageimage,source:image.descriptionurl,metadata:image.extmetadata,catalog:true};
 }
 console.log('Prepared',year,title);
}
await writeFile(root+'/assets/politics.json',JSON.stringify(output));
await writeFile(root+'/assets/manifest.json',JSON.stringify(manifest,null,2));
console.log('Saved',output.length,'political milestones');
