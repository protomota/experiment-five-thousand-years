import * as THREE from 'three';

export interface TouchPoint {x:number;y:number}
export interface TouchViewport {left:number;top:number;width:number;height:number}
const earth=new THREE.Sphere(new THREE.Vector3(),1);

export function surfacePoint(camera:THREE.PerspectiveCamera,point:TouchPoint,box:TouchViewport){
 camera.updateMatrixWorld();
 const ray=new THREE.Raycaster();
 ray.setFromCamera(new THREE.Vector2((point.x-box.left)/box.width*2-1,1-(point.y-box.top)/box.height*2),camera);
 return ray.ray.intersectSphere(earth,new THREE.Vector3());
}

/** Keep the ground beneath the fingers, with zoom measured above the surface. */
export function moveSurface(camera:THREE.PerspectiveCamera,from:TouchPoint,to:TouchPoint,box:TouchViewport,pinchRatio=1,minDistance=1.035,maxDistance=5){
 const anchor=surfacePoint(camera,from,box);
 const altitude=camera.position.length()-1;
 const ratio=Number.isFinite(pinchRatio)&&pinchRatio>0?pinchRatio:1;
 camera.position.setLength(THREE.MathUtils.clamp(1+altitude/ratio,minDistance,maxDistance));
 camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const zoomedPosition=camera.position.clone();
 let anchored=false;
 if(anchor){
  // Correct for north-up orientation after each spherical rotation. At close zoom
  // this converges to a sub-pixel match instead of multiplying an orbit speed.
  for(let iteration=0;iteration<6;iteration++){
   const underFinger=surfacePoint(camera,to,box);if(!underFinger)break;
   const rotation=new THREE.Quaternion().setFromUnitVectors(underFinger.normalize(),anchor.clone().normalize());
   camera.position.applyQuaternion(rotation);
   camera.lookAt(0,0,0);camera.updateMatrixWorld();anchored=true;
   if(underFinger.angleTo(anchor)<1e-7)break;
  }
  if(anchored){
   const projected=anchor.clone().project(camera);
   const error=Math.hypot(box.left+(projected.x+1)*box.width/2-to.x,box.top+(1-projected.y)*box.height/2-to.y);
   // North-up orientation becomes singular when a drag crosses a pole. Use a
   // bounded orbit there rather than allowing the view to flip around abruptly.
   if(error>1){camera.position.copy(zoomedPosition);anchored=false;}
  }
 }
 if(!anchored){
  // A finger outside the globe's limb still rotates it, without close-up overshoot.
  const anglePerPixel=Math.min(3.4,2*altitude*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2))/box.height;
  const position=new THREE.Spherical().setFromVector3(camera.position);
  position.theta-=(to.x-from.x)*anglePerPixel;
  position.phi=THREE.MathUtils.clamp(position.phi-(to.y-from.y)*anglePerPixel,.001,Math.PI-.001);
  camera.position.setFromSpherical(position);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 }
}

/** Coalesce pointer events into one camera update per rendered frame. */
export class SurfaceGesture {
 private points=new Map<number,TouchPoint>();
 private previous:TouchPoint[]=[];
 private origin:TouchPoint|null=null;
 private dragged=false;
 private dirty=false;
 get active(){return this.points.size>0;}
 constructor(private camera:THREE.PerspectiveCamera,private viewport:()=>TouchViewport,private start:()=>void,private finish:()=>void,private tap:(point:TouchPoint)=>void){}
 begin(id:number,point:TouchPoint){
  this.update();
  if(!this.active){this.start();this.origin=point;this.dragged=false;}
  this.points.set(id,point);if(this.points.size>1)this.dragged=true;
  this.rebase();
 }
 move(id:number,point:TouchPoint){
  if(!this.points.has(id))return;
  this.points.set(id,point);this.dirty=true;
  if(this.origin&&Math.hypot(point.x-this.origin.x,point.y-this.origin.y)>8)this.dragged=true;
 }
 end(id:number,cancelled=false){
  const point=this.points.get(id);if(!point)return;
  this.update();this.points.delete(id);this.rebase();
  if(cancelled)this.dragged=true;
  if(!this.active){if(!this.dragged)this.tap(point);this.finish();this.origin=null;}
 }
 private rebase(){this.previous=[...this.points.values()].slice(0,2).map(point=>({...point}));this.dirty=false;}
 update(){
  if(!this.dirty||!this.active)return;
  const current=[...this.points.values()].slice(0,2);
  if(current.length!==this.previous.length){this.rebase();return;}
  const center=(points:TouchPoint[])=>({x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length});
  const span=(points:TouchPoint[])=>Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
  const ratio=current.length===2&&span(this.previous)>12&&span(current)>12?span(current)/span(this.previous):1;
  moveSurface(this.camera,center(this.previous),center(current),this.viewport(),ratio);
  this.rebase();
 }
 cancel(){this.points.clear();this.previous=[];this.dirty=false;this.dragged=true;this.origin=null;this.finish();}
}

export class GlobeTouchControls {
 readonly gesture:SurfaceGesture;
 private abort=new AbortController();
 constructor(element:HTMLElement,camera:THREE.PerspectiveCamera,start:()=>void,finish:()=>void,tap:(point:TouchPoint)=>void){
  this.gesture=new SurfaceGesture(camera,()=>element.getBoundingClientRect(),start,finish,tap);
  const options={capture:true,passive:false,signal:this.abort.signal};
  const own=(event:PointerEvent)=>{if(event.pointerType!=='touch')return false;if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();return true;};
  element.addEventListener('pointerdown',event=>{if(!own(event))return;this.gesture.begin(event.pointerId,{x:event.clientX,y:event.clientY});element.setPointerCapture(event.pointerId);},options);
  element.addEventListener('pointermove',event=>{if(own(event))this.gesture.move(event.pointerId,{x:event.clientX,y:event.clientY});},options);
  const end=(event:PointerEvent)=>{if(!own(event))return;this.gesture.end(event.pointerId,event.type!=='pointerup');if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);};
  element.addEventListener('pointerup',end,options);element.addEventListener('pointercancel',end,options);
  element.addEventListener('lostpointercapture',event=>{if(event.pointerType==='touch')this.gesture.end(event.pointerId,true);},{signal:this.abort.signal});
  // Safari's page-zoom gesture must not compete with gestures on this canvas.
  for(const name of ['gesturestart','gesturechange'])element.addEventListener(name,event=>event.preventDefault(),options);
  window.addEventListener('blur',()=>this.gesture.cancel(),{signal:this.abort.signal});
 }
 dispose(){this.abort.abort();this.gesture.cancel();}
}
