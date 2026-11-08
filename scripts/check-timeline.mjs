import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {events} from '../src/events.ts';

// Exercise the real timeline's animation and input handlers with a minimal DOM.
class Element {
 children=[];listeners={};style={setProperty(name,value){this[name]=value;}};
 dataset={};attributes={};classList={toggle(){}};clientWidth=1200;
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(name,listener){this.listeners[name]=listener;}
 querySelector(){return this.markers;}
 querySelectorAll(){return this.markers.children;}
 setPointerCapture(){}hasPointerCapture(){return false;}
}
globalThis.document={createElement:()=>new Element()};
globalThis.matchMedia=()=>({matches:false});
globalThis.ResizeObserver=class {constructor(callback){this.callback=callback;}observe(){this.callback();}};
const code=stripTypeScriptTypes(readFileSync('src/timeline.ts','utf8'),{mode:'transform'});
const eventsUrl='data:text/javascript;base64,'+Buffer.from('export const formatYear='+String((await import('../src/events.ts')).formatYear)+'; export const categoryColors='+JSON.stringify((await import('../src/events.ts')).categoryColors)+';').toString('base64');
const {FocusTimeline}=await import('data:text/javascript;base64,'+Buffer.from(code.replace("'./events'",JSON.stringify(eventsUrl))).toString('base64'));
const items=events.slice(0,8);
function fixture(index=1){
 const host=new Element();host.markers=new Element();const changes=[];
 const rail=new FocusTimeline(host,event=>{changes.push(event.id);rail.setItems(items,event,false);},()=>rail.setVelocity(0));
 rail.setItems(items,items[index]);return {host,rail,changes};
}
{
 const {rail,changes}=fixture();rail.setVelocity(1);
 rail.tick(.6);assert.deepEqual(changes,[],'must not select at halfway');
 rail.tick(.39);assert.deepEqual(changes,[],'must not select just before center');
 rail.tick(.02);assert.deepEqual(changes,[items[2].id],'select after crossing center');
 rail.setVelocity(-1);rail.tick(.02);assert.deepEqual(changes,[items[2].id],'crossing the same dot again must not change story');
 rail.tick(.98);assert.deepEqual(changes,[items[2].id],'backward travel must wait for the previous dot');
 rail.tick(.02);assert.deepEqual(changes,[items[2].id,items[1].id]);
}
{
 const {rail,changes,host}=fixture();
 host.listeners.click({target:{closest:()=>host.markers.children[2]}});
 assert.deepEqual(changes,[],'click must wait for centering');
 rail.tick(.05);assert.deepEqual(changes,[]);
 for(let frame=0;frame<100;frame++)rail.tick(.016);
 assert.deepEqual(changes,[items[2].id],'easing must finish exactly at the target');
 const center=host.markers.children[2];assert.equal(center.style.left,'600px');assert.equal(center.style['--depth-scale'],'2');
 assert.equal(new Set(host.markers.children.map(button=>button.style.top)).size,1,'all dots stay on one horizontal line');
 assert.ok(host.markers.children.every(button=>!button.hidden),'offscreen markers remain rendered');
 assert.ok(host.markers.children.at(-1).style.filter.startsWith('blur('));
}
{
 const {rail,changes,host}=fixture();
 host.listeners.pointerdown({button:0,pointerId:1,clientX:500});
 host.listeners.pointermove({pointerId:1,clientX:381}); // 70% of the next interval
 assert.deepEqual(changes,[],'drag must not select before center');
 host.listeners.pointerup({pointerId:1});
 for(let frame=0;frame<100;frame++)rail.tick(.016);
 assert.deepEqual(changes,[items[2].id],'release snap selects only on arrival');
}
{
 const {rail,changes}=fixture();rail.focus(items[6].id);
 for(let frame=0;frame<120;frame++)rail.tick(.016);
 assert.deepEqual(changes,[items[6].id],'a distant click must fly directly to its destination without visiting intermediate milestones');
}
{
 const host=new Element();host.markers=new Element();const flights=[],selections=[];
 const rail=new FocusTimeline(host,(event,started)=>{selections.push([event.id,started]);rail.setItems(items,event,false);},()=>rail.setVelocity(0),event=>flights.push(event.id));
 rail.setItems(items,items[1]);flights.length=0;
 rail.focus(items[6].id);assert.deepEqual(flights,[items[6].id],'one immediate flight to the clicked destination');
 for(let frame=0;frame<120;frame++)rail.tick(.016);
 assert.deepEqual(flights,[items[6].id],'intermediate timeline dots never redirect the globe');
 assert.deepEqual(selections,[[items[6].id,true]],'arrival does not restart the flight');
 host.listeners.pointerdown({button:0,pointerId:1,clientX:500});host.listeners.pointermove({pointerId:1,clientX:619});host.listeners.pointerup({pointerId:1});
 for(let frame=0;frame<120;frame++)rail.tick(.016);
 assert.deepEqual(selections.at(-1),[items[5].id,false],'drag snapping still moves the globe on center arrival');
}
console.log('PASS: forward/reverse center crossings, click arrival, drag snapping, aligned scaling, and offscreen rendering.');
