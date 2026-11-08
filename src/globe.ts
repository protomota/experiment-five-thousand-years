import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { events, categoryColors, type Milestone } from './events';
import {MapDetail,type AreaShape} from './map-detail';
import {createGlobeFlight,isGlobeDestinationVisible,sampleGlobeFlight} from './globe-flight';
import {GlobeTouchControls} from './globe-touch';
import {assetUrl} from './assets';

export function coordinates(lat:number,lon:number,radius=1){const phi=lat*Math.PI/180,theta=lon*Math.PI/180;return new THREE.Vector3(radius*Math.cos(phi)*Math.cos(theta),radius*Math.sin(phi),-radius*Math.cos(phi)*Math.sin(theta));}

export class HistoryGlobe {
 readonly renderer:THREE.WebGLRenderer;
 readonly camera=new THREE.PerspectiveCamera(35,1,0.001,100);
 readonly scene=new THREE.Scene();
 readonly controls:OrbitControls;
 readonly ready:Promise<void>;
 private pins=new THREE.Group();
 private pinBatches:{mesh:THREE.InstancedMesh;pins:THREE.Mesh[]}[]=[];
 private pinScale=-1;
 private pinsDirty=true;
 private selected=new THREE.Group();
 private ring:THREE.Mesh;
 private observer:ResizeObserver;
 private target:THREE.Vector3|null=null;
 private previous=new THREE.Vector3();
 private flight:ReturnType<typeof createGlobeFlight>|null=null;
 private transition=1;
 private active:Milestone=events[1];
 private down={x:0,y:0};
 private pointers=new Set<number>();
 private dragged=false;
 private zoomTarget:number|null=null;
 private detail:MapDetail|null=null;
 private areas=new Map<string,AreaShape>();
 private touch:GlobeTouchControls;
 private detailResumeAt=0;
 private introTimer:number|undefined;
 private navigationVersion=0;
 private reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 constructor(private host:HTMLElement,private onSelect?:(id:string,nearby?:string[])=>void,assetRoot=assetUrl('')){
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:!onSelect});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.5:2));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.domElement.setAttribute('aria-label','Interactive globe. Drag to rotate, pinch or scroll to zoom, or choose a milestone on the timeline.');
  this.renderer.domElement.setAttribute('role','img');
  host.append(this.renderer.domElement);
  this.camera.position.copy(coordinates(24,25,3.7));
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);
  this.controls.enablePan=false;this.controls.enableDamping=false;this.controls.minDistance=1.035;this.controls.maxDistance=5;this.controls.rotateSpeed=0.55;
  this.controls.enableZoom=true;
  this.controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE};
  this.controls.addEventListener('start',()=>this.beginInteraction());
  this.touch=new GlobeTouchControls(this.renderer.domElement,this.camera,()=>this.beginInteraction(),()=>{this.detailResumeAt=performance.now()+180;},point=>{const nearby=this.hitTargets(point.x,point.y);if(nearby.length)this.onSelect?.(nearby[0],nearby);});
  if(onSelect)this.detail=new MapDetail(this.camera,this.scene,this.renderer);
  const material=new THREE.MeshPhongMaterial({color:onSelect?0x9bb3bd:0x829da5,shininess:0,specular:0x000000});
  this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1,112,72),material));
  this.scene.add(new THREE.AmbientLight(0xd6e5f5,2.0));
  const sunlight=new THREE.DirectionalLight(0xffe5b7,2.8);sunlight.position.set(-2,3,4);this.camera.add(sunlight);this.scene.add(this.camera);
  this.ready=new Promise(resolve=>new THREE.TextureLoader().load(`${assetRoot}${onSelect?'earth-relief.jpg':'earth.jpg'}`,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;this.renderer.initTexture(texture);material.map=texture;material.needsUpdate=true;resolve();},undefined,()=>{host.dataset.textureError='true';resolve();}));
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.035,64,48),new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 n; varying vec3 v; void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(v))),4.0);gl_FragColor=vec4(.24,.48,.68,a*.38);}'}));this.scene.add(atmosphere);
  const gridMaterial=new THREE.LineBasicMaterial({color:0xb7c9d7,transparent:true,opacity:.12});
  for(let lat=-60;lat<=60;lat+=30){const points=Array.from({length:181},(_,i)=>coordinates(lat,i*2-180,1.003));this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),gridMaterial));}
  for(let lon=-180;lon<180;lon+=30){const points=Array.from({length:91},(_,i)=>coordinates(i*2-90,lon,1.003));this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),gridMaterial));}
  const pinGeometry=new THREE.SphereGeometry(.010,10,8),pinMaterials=new Map<string,THREE.MeshBasicMaterial>();
  events.forEach(event=>{let material=pinMaterials.get(event.category);if(!material){material=new THREE.MeshBasicMaterial({color:categoryColors[event.category]});pinMaterials.set(event.category,material);}const mesh=new THREE.Mesh(pinGeometry,material);mesh.position.copy(coordinates(event.lat,event.lon,1.002));mesh.userData.id=event.id;this.pins.add(mesh);});
  for(const material of pinMaterials.values()){
   const pins=this.pins.children.filter(pin=>(pin as THREE.Mesh).material===material) as THREE.Mesh[];
   const mesh=new THREE.InstancedMesh(pinGeometry,material,pins.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
   this.pinBatches.push({mesh,pins});this.scene.add(mesh);
  }
  this.updatePins(1);
  this.ring=new THREE.Mesh(new THREE.RingGeometry(.032,.037,64),new THREE.MeshBasicMaterial({color:0xf5d18a,side:THREE.DoubleSide,transparent:true,opacity:.95}));
  this.selected.add(this.ring);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.015,18,12),new THREE.MeshBasicMaterial({color:0xffe3a3}));this.selected.add(dot);
  const stem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,.15)]),new THREE.LineBasicMaterial({color:0xf5d18a}));this.selected.add(stem);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.007,10,8),new THREE.MeshBasicMaterial({color:0xffe3a3}));tip.position.z=.15;this.selected.add(tip);this.scene.add(this.selected);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  this.renderer.domElement.addEventListener('pointerdown',e=>{if(this.pointers.size===0){this.down={x:e.clientX,y:e.clientY};this.dragged=false;}this.pointers.add(e.pointerId);if(this.pointers.size>1)this.dragged=true;});
  this.renderer.domElement.addEventListener('pointermove',e=>{if(this.pointers.has(e.pointerId)&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>(e.pointerType==='touch'?10:6))this.dragged=true;});
  this.renderer.domElement.addEventListener('pointercancel',e=>{this.pointers.delete(e.pointerId);this.dragged=true;});
  this.renderer.domElement.addEventListener('pointerup',e=>{const tracked=this.pointers.delete(e.pointerId);if(!tracked||this.dragged||this.pointers.size||e.button!==0)return;const nearby=this.hitTargets(e.clientX,e.clientY);if(nearby.length)this.onSelect?.(nearby[0],nearby);});
  this.select(events[1],true);
 }
 // Pick in CSS pixels so the generous target stays the same size at every zoom and device density.
 private hitTargets(clientX:number,clientY:number){
  const box=this.renderer.domElement.getBoundingClientRect();this.camera.updateMatrixWorld();
  const hits:{id:string;distance:number}[]=[];
  for(const pin of this.pins.children){
   if(!pin.visible)continue;
   const point=pin.getWorldPosition(new THREE.Vector3());
   if(point.dot(this.camera.position.clone().sub(point))<=0)continue;
   const projected=point.clone().project(this.camera);
   if(Math.abs(projected.x)>1||Math.abs(projected.y)>1||Math.abs(projected.z)>1)continue;
   const x=box.left+(projected.x+1)*box.width/2,y=box.top+(1-projected.y)*box.height/2;
   const distance=Math.hypot(clientX-x,clientY-y);
   if(distance<=24)hits.push({id:pin.userData.id as string,distance});
  }
  hits.sort((a,b)=>a.distance-b.distance);
  if(hits[0]?.distance<=8&&(!hits[1]||hits[1].distance>12))return [hits[0].id];
  return hits.map(hit=>hit.id);
 }
 resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(35)/2)/Math.min(1,this.camera.aspect)));this.camera.updateProjectionMatrix();this.render();}
 private cancelIntro(){this.navigationVersion++;if(this.introTimer!==undefined)clearTimeout(this.introTimer);this.introTimer=undefined;}
 private beginInteraction(){this.cancelIntro();this.target=null;this.flight=null;this.zoomTarget=null;this.transition=1;this.host.dispatchEvent(new Event('globe-interaction'));}
 startIntro(event:Milestone){
  if(this.reduced){this.select(event);return;}
  this.select(event,true);const version=this.navigationVersion;
  void this.ready.then(()=>{if(version!==this.navigationVersion)return;this.introTimer=window.setTimeout(()=>{this.introTimer=undefined;if(version===this.navigationVersion)this.select(event);},1000);});
 }
 private focusDistance(area?:AreaShape){return THREE.MathUtils.clamp(area?.focusDistance??Math.max(1.22,area?.distance??1.8),1.08,3.7);}
 select(event:Milestone,immediate=false){this.cancelIntro();this.zoomTarget=null;this.active=event;
  for(const child of this.selected.children)if(child instanceof THREE.Mesh||child instanceof THREE.Line)(child.material as THREE.MeshBasicMaterial|THREE.LineBasicMaterial).color.set(categoryColors[event.category]);this.selected.position.copy(coordinates(event.lat,event.lon,1.002));this.selected.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),coordinates(event.lat,event.lon));this.previous.copy(this.camera.position);this.target=coordinates(event.lat,event.lon,immediate||!this.detail?3.7:this.focusDistance(this.areas.get(event.id)));
  const visible=!immediate&&Boolean(this.detail)&&isGlobeDestinationVisible(this.camera,this.target);
  if(visible)this.target.setLength(Math.min(this.previous.length(),this.target.length()));
  this.flight=createGlobeFlight(this.previous,this.target,visible);void this.focusArea(event,immediate);this.transition=immediate||this.reduced?1:0;if(this.transition===1)this.camera.position.copy(this.target);this.controls.update();}
 private updatePins(scale:number){
  if(!this.pinsDirty&&Math.abs(this.pinScale-scale)<.000001)return;
  const matrix=new THREE.Matrix4();
  for(const batch of this.pinBatches){batch.pins.forEach((pin,index)=>{const size=pin.visible?scale:0;matrix.makeScale(size,size,size).setPosition(pin.position);batch.mesh.setMatrixAt(index,matrix);});batch.mesh.instanceMatrix.needsUpdate=true;}
  this.pinScale=scale;this.pinsDirty=false;
 }
 filter(ids:Set<string>){for(const pin of this.pins.children)pin.visible=ids.has(pin.userData.id as string);this.pinsDirty=true;}
 private async focusArea(event:Milestone,immediate:boolean){
  if(!this.detail)return;
  this.detail.clearArea();this.host.dispatchEvent(new CustomEvent('area-change',{detail:null}));
  try{
   let area=this.areas.get(event.id);
   if(!area){const response=await fetch(assetUrl(`areas/${event.id}.json`));if(!response.ok)return;area=await response.json() as AreaShape;this.areas.set(event.id,area);}
   if(this.active.id!==event.id)return;
   this.detail.showArea(area);this.host.dispatchEvent(new CustomEvent('area-change',{detail:area}));
   if(!immediate&&this.target){const requested=this.focusDistance(area);const distance=this.flight?.direct?Math.min(this.camera.position.length(),this.target.length(),requested):requested;this.target.setLength(distance);if(this.transition===1)this.zoomTarget=distance;}
  }catch{this.host.dispatchEvent(new CustomEvent('area-change',{detail:null}));}
 }
 tick(delta:number,time:number){this.touch.gesture.update();if(this.zoomTarget!==null){const distance=THREE.MathUtils.lerp(this.camera.position.length(),this.zoomTarget,1-Math.exp(-10*delta));this.camera.position.setLength(distance);if(Math.abs(distance-this.zoomTarget)<.001){this.camera.position.setLength(this.zoomTarget);this.zoomTarget=null;}this.controls.update();}if(this.target&&this.flight&&this.transition<1){this.transition=Math.min(1,this.transition+delta/this.flight.duration);sampleGlobeFlight(this.flight,this.target,this.transition,this.camera.position);this.controls.update();}const markerScale=Math.max(.025,Math.min(1,(this.camera.position.length()-1)/2.7));this.selected.scale.setScalar(markerScale);this.updatePins(markerScale);this.controls.rotateSpeed=Math.max(.05,Math.min(.55,(this.camera.position.length()-1)*.3));this.detail?.update(time,delta,!this.target||this.transition===1,this.touch.gesture.active||performance.now()<this.detailResumeAt);this.ring.scale.setScalar(this.reduced?1:1+Math.sin(time*2)*.12);this.render();}
 seek(from:Milestone,to:Milestone,progress:number){this.select(to,true);const a=coordinates(from.lat,from.lon),b=coordinates(to.lat,to.lon);const q=new THREE.Quaternion().setFromUnitVectors(a,b);this.camera.position.copy(a.applyQuaternion(new THREE.Quaternion().slerp(q,progress)).multiplyScalar(3.7));this.camera.lookAt(0,0,0);this.render();}
 render(){this.detail?.updateAreaVisibility(this.selected,.037*1.12*this.selected.scale.x,this.host.clientWidth,this.host.clientHeight);this.renderer.render(this.scene,this.camera);}
 reset(){this.select(this.active);}
 zoom(factor:number){this.cancelIntro();this.target=null;this.transition=1;this.zoomTarget=THREE.MathUtils.clamp((this.zoomTarget??this.camera.position.length())*factor,this.controls.minDistance,this.controls.maxDistance);if(this.reduced){this.camera.position.setLength(this.zoomTarget);this.zoomTarget=null;this.controls.update();this.render();}}
 dispose(){this.cancelIntro();this.touch.dispose();this.detail?.dispose();this.observer.disconnect();this.controls.dispose();this.scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});this.renderer.dispose();}
}
