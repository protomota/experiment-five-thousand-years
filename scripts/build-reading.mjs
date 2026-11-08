import {fileURLToPath} from 'node:url';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {events} from '../src/events.ts';

// Licensed source selections are stored independently from the short atlas cards.
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const cache=root+'/cache/reading';
const output=root+'/assets/reading';
await mkdir(cache,{recursive:true});
await mkdir(output,{recursive:true});
const words=text=>text.trim().split(/\s+/).filter(Boolean).length;
const clean=text=>text.replace(/\[\d+\]/g,'').replace(/\bBC\b/g,'BCE').replace(/\bAD\b/g,'CE').replace(/\s+/g,' ').trim();
const sourceOverrides={wwi:'World_War_I',alexander:'History_of_Alexandria',buddha:'The_Buddha',gupta:'Aryabhatiya'};

let nextRequest=0;
async function retrieve(title){
 const params=new URLSearchParams({action:'query',format:'json',prop:'extracts|info',inprop:'url',explaintext:'1',exlimit:'1',titles:title,redirects:'1'});
 const path=cache+'/'+createHash('sha256').update(title).digest('hex')+'.json';
 try{return JSON.parse(await readFile(path,'utf8'));}catch{}
 for(let attempt=0;attempt<10;attempt++){
  const scheduled=Math.max(Date.now(),nextRequest);nextRequest=scheduled+400;
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,scheduled-Date.now())));
  const response=await fetch('https://en.wikipedia.org/w/api.php?'+params,{headers:{'User-Agent':'FiveThousandYearsAtlas/1.0 (https://five-thousand-years.ngrok.app/; educational history atlas)'},signal:AbortSignal.timeout(45000)});
  if(response.status===429||response.status>=500){const delay=Math.max(5000,Number(response.headers.get('retry-after')||0)*1000,Math.min(30000,5000*2**attempt));nextRequest=Math.max(nextRequest,Date.now()+delay);continue;}
  if(!response.ok)throw Error(title+': HTTP '+response.status);
  const data=await response.json();if(data.error)throw Error(JSON.stringify(data.error));
  const page=Object.values(data.query.pages)[0];
  if(!page.extract)throw Error(title+': no source prose');
  await writeFile(path,JSON.stringify(page));return page;
 }
 throw Error(title+': source unavailable after retries');
}

function selectSections(extract,presidency=false){
 const sections=[];let section={heading:'Overview',paragraphs:[]};
 for(const line of extract.split('\n')){
  const heading=line.match(/^=+\s*(.*?)\s*=+$/);
  if(heading){if(section.paragraphs.length)sections.push(section);section={heading:heading[1],paragraphs:[]};continue;}
  const text=clean(line);
  // Bibliographies, lists, captions, and sentence fragments are not reading prose.
  if(words(text)>=25&&/[.!?][”’"')\]]?$/.test(text))section.paragraphs.push(text);
 }
 if(section.paragraphs.length)sections.push(section);
 const usable=sections.filter(section=>!/(?:references|notes|bibliography|further reading|external links|see also|sources|footnotes|citations)/i.test(section.heading));
 const priority=heading=>presidency?(/presidenc/i.test(heading)?5:/legacy|reputation|domestic policy|economic policy|foreign policy/i.test(heading)?4:/early life|education/i.test(heading)?3:/election|political career/i.test(heading)?2:1):/aftermath|legacy|impact|consequences|significance|outcome|results|effects/i.test(heading)?3:/background|origins|causes|history|events|development|revolution|battle|war|discovery/i.test(heading)?2:1;
 const chosen=new Map();let total=0;
 const add=(index,limit)=>{
  const section=usable[index];if(!section)return;
  const entry=chosen.get(index)||{heading:section.heading,paragraphs:[]};let count=0;
  for(const paragraph of section.paragraphs.slice(entry.paragraphs.length)){
   if(total>=1200||count>=limit)break;
   entry.paragraphs.push(paragraph);const size=words(paragraph);count+=size;total+=size;
  }
  if(entry.paragraphs.length)chosen.set(index,entry);
 };
 add(0,320);
 const ranked=usable.map((section,index)=>({index,priority:priority(section.heading)})).slice(1).sort((a,b)=>b.priority-a.priority||a.index-b.index);
 // Cover several subjects, including outcomes, rather than stopping in early background.
 for(const {index} of ranked.slice(0,5))add(index,180);
 for(let index=0;index<usable.length&&total<1200;index++)add(index,1200-total);
 return [...chosen.entries()].sort((a,b)=>a[0]-b[0]).map(([,section])=>section);
}

const selectedEvents=process.argv.includes('--new-politics')?events.filter(event=>event.presidency||event.id.startsWith('politics-')):events;
const report=[];let cursor=0;
async function worker(){
 while(cursor<selectedEvents.length){
  const event=selectedEvents[cursor++];
  try{
   const page=await retrieve(sourceOverrides[event.id]||event.article);
   const sections=selectSections(page.extract,Boolean(event.presidency));
   const wordCount=sections.reduce((sum,section)=>sum+words(section.paragraphs.join(' ')),0);
   const article={id:event.id,sections,wordCount,source:{title:page.title,url:page.canonicalurl||page.fullurl||'https://en.wikipedia.org/wiki/'+encodeURIComponent(page.title.replaceAll(' ','_')),revision:page.lastrevid,license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',note:'Selected passages from Wikipedia contributors. Sections are abridged; citation markers and formatting are removed, and dates use BCE/CE. The source revision retains the complete article and references.'}};
   await writeFile(output+'/'+event.id+'.json',JSON.stringify(article));report.push({id:event.id,title:event.title,words:wordCount});
  }catch(error){report.push({id:event.id,error:String(error)});console.log(event.id,String(error));}
  if(report.length%25===0)console.log('Saved reading:',report.length,'/',selectedEvents.length);
  await new Promise(resolve=>setTimeout(resolve,250));
 }
}
await Promise.all([worker(),worker(),worker()]);
await writeFile(root+'/reading-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({total:report.length,long:report.filter(entry=>entry.words>=900).length,short:report.filter(entry=>entry.words<900),errors:report.filter(entry=>entry.error)},null,2));
