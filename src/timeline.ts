import { categoryColors, formatYear, type Milestone } from './events';

/** A milestone-spaced rail: elapsed years are labels, not physical distances. */
export class FocusTimeline {
 private items:Milestone[]=[];
 private buttons:HTMLButtonElement[]=[];
 private position=0;
 private target=0;
 private velocity=0;
 private travelStarted=false;
 private active='';
 private pointer:{id:number;x:number;position:number;moved:boolean}|null=null;
 private suppressClick=false;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 private width=0;
 constructor(private host:HTMLElement,private onSelect:(event:Milestone,travelStarted?:boolean)=>void,private onStop:()=>void,private onTravel?:(event:Milestone)=>void){
  new ResizeObserver(()=>{this.width=host.clientWidth;this.draw();}).observe(host);
  host.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;
   this.onStop();this.suppressClick=false;
   this.pointer={id:event.pointerId,x:event.clientX,position:this.position,moved:false};
  });
  host.addEventListener('pointermove',event=>{
   if(!this.pointer||this.pointer.id!==event.pointerId)return;
   const distance=event.clientX-this.pointer.x;
   if(Math.abs(distance)>6){this.pointer.moved=true;host.setPointerCapture(event.pointerId);}
   if(this.pointer.moved)this.scrub(this.pointer.position-distance/this.spacing());
  });
  const release=(event:PointerEvent)=>{
   if(!this.pointer||event.pointerId!==this.pointer.id)return;
   this.suppressClick=this.pointer.moved;this.pointer=null;
   if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);
   this.target=Math.round(this.position);
  };
  host.addEventListener('pointerup',release);
  host.addEventListener('pointercancel',release);
  host.addEventListener('click',event=>{
   if(this.suppressClick){this.suppressClick=false;return;}
   const id=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-id]')?.dataset.id;
   const item=this.items.find(item=>item.id===id);
   if(item){this.onStop();this.focus(item.id);}
  });
  host.addEventListener('wheel',event=>{
   event.preventDefault();this.onStop();
   this.scrub(this.target+(Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)/200);
  },{passive:false});
 }
 private spacing(){return this.width<600?112:170;}
 setItems(items:Milestone[],selected:Milestone,center=true){
  if(items.map(item=>item.id).join()!==this.items.map(item=>item.id).join()){
   this.items=items;
   this.host.querySelector('#markers')!.replaceChildren(...items.map(item=>{
    const button=document.createElement('button');button.className='milestone';button.dataset.id=item.id;
    button.style.setProperty('--marker',categoryColors[item.category]);
    button.setAttribute('aria-label',`${formatYear(item.year)}: ${item.title}`);
    const dot=document.createElement('span');dot.className='marker-dot';
    const date=document.createElement('span');date.className='marker-date';date.textContent=formatYear(item.year,item.approximate);
    const title=document.createElement('span');title.className='marker-title';title.textContent=item.title;
    button.append(dot,date,title);return button;
   }));
   this.buttons=Array.from(this.host.querySelectorAll('.milestone'));
   this.position=Math.max(0,items.indexOf(selected));this.target=this.position;
  }
  this.active=selected.id;
  if(center)this.focus(selected.id);
  this.draw();
 }
 focus(id:string){const index=this.items.findIndex(item=>item.id===id);if(index>=0){this.target=index;this.travelStarted=!!this.onTravel;this.onTravel?.(this.items[index]);}}
 setVelocity(value:number){this.velocity=value;this.target=this.position;this.travelStarted=false;}
 private scrub(position:number){
  this.target=Math.max(0,Math.min(this.items.length-1,position));
  this.moveTo(this.target);
 }
 private moveTo(position:number,selectCrossing=true){
  const previous=this.position;this.position=position;
  // Keep the current story until another dot actually crosses the focus line.
  const index=position>previous&&Math.floor(position)>Math.floor(previous)?Math.floor(position)
   :position<previous&&Math.ceil(position)<Math.ceil(previous)?Math.ceil(position):-1;
  if(selectCrossing)this.activate(index);
  this.draw();
 }
 private activate(index:number,travelStarted=false){
  const event=this.items[index];
  if(event&&event.id!==this.active){this.active=event.id;this.onSelect(event,travelStarted);}
 }
 tick(delta:number){
  if(this.velocity&&this.items.length){
   this.scrub(this.position+this.velocity*delta);
   if(this.position<=0||this.position>=this.items.length-1)this.onStop();
  }else if(this.target!==this.position){
   const next=this.position+(this.target-this.position)*(1-Math.exp(-9*delta));
   this.moveTo(this.reduced||Math.abs(this.target-next)<.001?this.target:next,false);
   // A deliberate destination must not redirect the globe through intermediate events.
   if(this.position===this.target){this.activate(this.target,this.travelStarted);this.draw();}
  }
 }
 private draw(){
  const spacing=this.spacing();
  this.buttons.forEach((button,index)=>{
   const distance=index-this.position;
   const x=this.width/2+spacing*distance/Math.sqrt(1+Math.abs(distance)*.22);
   const depth=Math.min(1,Math.abs(x-this.width/2)/(this.width/2));
   if((x< -180||x>this.width+180)&&button.style.opacity==='0')return;
   // Keep the whole rail rendered; the viewport clips it beyond the edges.
   const onScreen=x>=26&&x<=this.width-26;
   button.tabIndex=onScreen?0:-1;
   button.setAttribute('aria-hidden',String(!onScreen));
   button.style.left=`${x}px`;
   button.style.top='16px';
   const centerScale=1+Math.max(0,1-Math.abs(distance));
   button.style.setProperty('--depth-scale',String(centerScale*(1-depth*.25)));
   button.style.opacity=String(1-Math.pow(depth,2));
   button.style.filter=`blur(${Math.pow(depth,3)*2.2}px)`;
   button.classList.toggle('selected',button.dataset.id===this.active);
   button.setAttribute('aria-pressed',String(button.dataset.id===this.active));
  });
 }
}
