import { gsap } from 'gsap';
import { HistoryGlobe } from './globe';
import { events } from './events';
const filmWindow=window as unknown as {__timelines:Record<string,gsap.core.Timeline>;__hf:{buildReady:Record<string,Promise<void>>}};
filmWindow.__timelines??={};filmWindow.__hf??={buildReady:{}};filmWindow.__hf.buildReady??={};
const globe=new HistoryGlobe(document.querySelector<HTMLElement>('#film-globe')!,undefined,'assets/');
globe.controls.enabled=false;
const scenes=['pyramids','angkor','apollo'].map(id=>events.find(event=>event.id===id)!);
const cuts=[0,4.5,9];
function renderAt(time:number){const index=time<4.5?0:time<9?1:2;const fraction=Math.min(1,Math.max(0,(time-cuts[index])/1.4));const ease=fraction*fraction*(3-2*fraction);globe.seek(scenes[Math.max(0,index-1)],scenes[index],ease);}
const timeline=gsap.timeline({paused:true,onUpdate:()=>renderAt(timeline.time())});
timeline.fromTo('#film-brand',{opacity:.3},{opacity:1,duration:1},0);
for(let index=0;index<3;index++){timeline.fromTo(`#scene-${index} .scene-content`,{opacity:0,y:25},{opacity:1,y:0,duration:.65,ease:'power2.out'},cuts[index]+.05);if(index<2)timeline.to(`#scene-${index} .scene-content`,{opacity:0,duration:.3},cuts[index+1]-.32);}
timeline.fromTo('#film-progress',{scaleX:0},{scaleX:1,duration:14,ease:'none'},0);
timeline.to({}, {duration:.001},13.999);
(window as unknown as {__timelines:Record<string,gsap.core.Timeline>}).__timelines['atlas-prologue']=timeline;
window.addEventListener('hf-seek',event=>renderAt((event as CustomEvent<{time:number}>).detail.time));
filmWindow.__hf.buildReady['globe']=globe.ready.then(()=>{renderAt(0);});
renderAt(0);
