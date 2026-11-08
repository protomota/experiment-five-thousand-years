import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as THREE from 'three';
const compiled=transformSync(readFileSync('src/globe-touch.ts','utf8'),{loader:'ts',format:'esm'}).code.replace('from "three"',`from "${import.meta.resolve('three')}"`);
const {moveSurface,surfacePoint,SurfaceGesture}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const box={left:14,top:180,width:390,height:250};
const center={x:209,y:305};
function camera(radius=1.22,latitude=0){const camera=new THREE.PerspectiveCamera(35,390/250,.001,100);const angle=latitude*Math.PI/180;camera.position.set(0,Math.sin(angle)*radius,Math.cos(angle)*radius);camera.lookAt(0,0,0);return camera;}
function screen(point,camera){const p=point.clone().project(camera);return {x:box.left+(p.x+1)*box.width/2,y:box.top+(1-p.y)*box.height/2};}
for(const radius of [1.035,1.08,1.22,1.6,3.7])for(const latitude of [0,45]){
 const view=camera(radius,latitude),anchor=surfacePoint(view,center,box),destination={x:center.x+30,y:center.y+15};
 moveSurface(view,center,destination,box);
 const projected=screen(anchor,view);
 assert(Math.hypot(projected.x-destination.x,projected.y-destination.y)<.5,`Finger tracks ground at radius ${radius}, latitude ${latitude}`);
 assert(Math.abs(view.position.length()-radius)<1e-8,'One-finger drag preserves zoom');
}
const view=camera(),anchor=surfacePoint(view,center,box);
moveSurface(view,center,center,box,2);
assert(Math.abs(view.position.length()-1.11)<1e-8,'Doubling pinch span halves altitude, not Earth-center distance');
assert(screen(anchor,view).x===center.x,'Centered pinch preserves center');
moveSurface(view,center,center,box,1000);assert(Math.abs(view.position.length()-1.035)<1e-8,'Near zoom limit');
moveSurface(view,center,center,box,.000001);assert(Math.abs(view.position.length()-5)<1e-8,'Far zoom limit');

const handoff=camera();let taps=0,starts=0,ends=0;
const gesture=new SurfaceGesture(handoff,()=>box,()=>starts++,()=>ends++,()=>taps++);
gesture.begin(1,{x:169,y:305});gesture.begin(2,{x:249,y:305});
const before=handoff.position.clone();
gesture.move(1,{x:149,y:305});gesture.move(2,{x:269,y:305});
assert(handoff.position.equals(before),'Input events wait for the render frame');
gesture.update();assert(Math.abs(handoff.position.length()-(1+.22/1.5))<1e-8,'Two-pointer pinch is coalesced correctly');
const released=handoff.position.clone();gesture.end(2);gesture.update();
assert(handoff.position.distanceTo(released)<1e-9,'Lifting one finger does not jump the camera');
gesture.move(1,{x:151,y:305});gesture.update();
assert(handoff.position.angleTo(released)<.01,'Remaining finger resumes from its current position');
gesture.end(1);assert.equal(taps,0,'Pinching never opens a marker');assert.equal(starts,1);assert.equal(ends,1);
gesture.begin(3,center);gesture.end(3);assert.equal(taps,1,'A stationary tap still selects a marker');
gesture.begin(4,center);gesture.cancel();const cancelled=handoff.position.clone();gesture.move(4,{x:350,y:100});gesture.update();
assert(handoff.position.equals(cancelled),'Cancelled pointers cannot keep moving the globe');
console.log('PASS: surface-matched drag, altitude pinch, zoom limits, coalesced input, finger handoffs, tap suppression, and cancellation.');
