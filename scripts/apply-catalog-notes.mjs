import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
const path=`${process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url))}/assets/catalog.json`;
const events=JSON.parse(await readFile(path,'utf8')),notes=JSON.parse(await readFile('scripts/catalog-notes.json','utf8'));
let briefs={};try{briefs=JSON.parse(await readFile(`${process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url))}/assets/briefs.json`,'utf8'));}catch{}
for(const event of events){const note=notes[event.qid]||notes[event.id.replace('event-','').toUpperCase()];if(note){event.title=note.title||event.title;event.body=note.body;event.editorial=true;event.qid=note.qid||event.qid;event.article=note.article||event.article;if(note.sources)event.sources=note.replaceSources?note.sources:[...new Map([...note.sources,...event.sources].map(source=>[source.url,source])).values()];}}
for(const event of events){if(event.editorial){delete event.briefSource;continue;}const brief=briefs[event.id];if(brief){event.body=brief.body;event.briefSource=brief.briefSource;}}
await writeFile(path,JSON.stringify(events));console.log('Applied',Object.keys(notes).length,'editorial summaries and source checks.');
