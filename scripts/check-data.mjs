import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {events,categoryColors} from '../src/events.ts';
import {stories} from '../src/stories.ts';
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const assets=JSON.parse(await readFile(`${root}/assets/manifest.json`,'utf8'));
assert.equal(new Set(events.map(event=>event.id)).size,events.length,'Unique milestone IDs');
const articleKeys=events.map(event=>event.article.toLowerCase()+(event.presidency?':'+event.presidency.ordinal:''));
assert.equal(new Set(articleKeys).size,events.length,'Unique source articles or distinct nonconsecutive presidencies');
const presidents=events.filter(event=>event.presidency);
assert.equal(presidents.length,47,'All 47 presidencies');
assert.equal(new Set(presidents.map(event=>event.qid)).size,45,'45 individual presidents');
for(const [index,event] of presidents.entries()){assert.equal(event.presidency.ordinal,index+1);assert(event.facts?.some(fact=>fact.label==='Time served in this presidency'));assert(assets[event.id]?.image,'Portrait for every presidency');}
assert.equal(events[0].year,-3000);assert.equal(events.at(-1).year,2026);
let core=0,images=0,longReadings=0;
for(const [index,event] of events.entries()){
 assert(Number.isInteger(event.year)&&event.year!==0&&event.year>=-3000&&event.year<=2026,`${event.id}: date range`);
 assert(index===0||event.year>=events[index-1].year,`${event.id}: chronological order`);
 assert(Number.isFinite(event.lat)&&Number.isFinite(event.lon)&&Math.abs(event.lat)<=90&&Math.abs(event.lon)<=180,`${event.id}: coordinates`);
 assert(categoryColors[event.category],`${event.id}: recognized category`);
 assert(event.title&&event.body&&event.place,`${event.id}: readable content`);
 if(event.catalog){
  assert(event.body.trim().split(/\s+/).length>=40,`${event.id}: paragraph-length catalog overview`);
  if(event.briefSource)assert(event.briefSource.revision>0&&event.briefSource.license==='CC BY-SA 4.0'&&event.briefSource.url.startsWith('https://en.wikipedia.org/wiki/'),`${event.id}: excerpt attribution`);
  assert(/^Q\d+$/.test(event.qid),`${event.id}: source record`);
  assert(event.sources?.length>=2&&event.sources.every(source=>new URL(source.url).protocol==='https:'),`${event.id}: source links`);
 }else{
  core++;
  assert.equal(stories[event.id]?.length,2,`${event.id}: two additional story paragraphs`);
  const paragraphs=[event.body,...stories[event.id]];
  assert(paragraphs.every(text=>text.split(/\s+/).length>=20),`${event.id}: substantive paragraphs`);
  assert(assets[event.id]?.image&&assets[event.id]?.metadata,`${event.id}: original image and attribution`);
 }
 const asset=assets[event.id];assert(asset,`${event.id}: media record or explicit placeholder`);
 if(asset.image){const bytes=await readFile(`${root}/assets/${asset.image}`);assert(bytes.length>100&&(bytes[0]===0xff||bytes.subarray(1,4).toString()==='PNG'||bytes.subarray(0,4).toString()==='RIFF'||bytes.subarray(0,3).toString()==='GIF'),`${event.id}: valid image signature`);images++;}
 const area=JSON.parse(await readFile(`${root}/assets/areas/${event.id}.json`,'utf8'));
 assert(area.label&&area.distance>=1.035,`${event.id}: labeled map area`);
 const reading=JSON.parse(await readFile(`${root}/assets/reading/${event.id}.json`,'utf8'));
 const readingParagraphs=reading.sections.flatMap(section=>section.paragraphs);
 assert(reading.id===event.id&&readingParagraphs.length>=3,`${event.id}: separate multi-paragraph story`);
 const wordCount=readingParagraphs.join(' ').trim().split(/\s+/).length;
 assert(wordCount===reading.wordCount&&wordCount>=250,`${event.id}: substantive reading and accurate length`);
 assert(reading.source.revision>0&&reading.source.license==='CC BY-SA 4.0'&&reading.source.url.startsWith('https://en.wikipedia.org/wiki/'),`${event.id}: reading provenance and license`);
 if(wordCount>=900)longReadings++;
}
for(const [qid,year] of [['Q362',1939],['Q8740',1955],['Q8663',1950],['Q15733401',2014]]){
 assert.equal(events.find(event=>event.qid===qid)?.year,year,`${qid}: major milestone date`);
}
assert.equal(core,43,'Original authored stories retained');
assert(longReadings/events.length>=.9,'At least 90% of full readings contain 900+ words');
console.log(`PASS: ${events.length} dated, located, sourced milestones and separate readings; ${longReadings} with 900+ words; ${core} original stories; ${images} local images; all map areas.`);
