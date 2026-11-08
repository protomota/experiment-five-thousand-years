import * as THREE from 'three';
import {coordinates} from './globe';
export type PolygonCoordinates=number[][][];
export interface AreaShape {label:string;kind:string;year:number;source:string;license:string;geometry:{type:'Polygon'|'MultiPolygon';coordinates:PolygonCoordinates|PolygonCoordinates[]};distance:number;focusDistance?:number;}

/** NASA GIBS geographic tiles draped on the same sphere as the globe. */
export class MapDetail {
 readonly group=new THREE.Group();
 readonly highlight=new THREE.Group();
 private tiles=new Map<string,{mesh:THREE.Mesh;level:number}>();
 private pending=new Set<string>();
 private lastKey='';
 private lastUpdate=0;
 private requestedKeys=new Set<string>();
 private displayedKeys=new Set<string>();
 private displayedKey='';
 private opacity=0;
 private uploads:(()=>void)[]=[];
 private disposed=false;
 private loader=new THREE.TextureLoader();
 private areaBounds=new THREE.Box3();
 private areaOpacity=0;
 constructor(private camera:THREE.PerspectiveCamera,private scene:THREE.Scene,private renderer:THREE.WebGLRenderer){scene.add(this.group,this.highlight);}
 update(time:number,delta:number,allowDetails=true,interacting=false){
  // Upload at most one texture per frame, before it can become visible.
  if(!interacting)this.uploads.shift()?.();
  const distance=this.camera.position.length();
  const ready=this.requestedKeys.size>0&&[...this.requestedKeys].every(key=>this.tiles.has(key));
  const switching=!interacting&&ready&&this.displayedKey!==this.lastKey;
  const targetOpacity=allowDetails&&!switching?1-THREE.MathUtils.smoothstep(distance,1.1,1.6):0;
  this.opacity=THREE.MathUtils.lerp(this.opacity,targetOpacity,1-Math.exp(-10*delta));
  if(switching&&this.opacity<.02){
   this.displayedKeys=new Set(this.requestedKeys);this.displayedKey=this.lastKey;this.opacity=0;
   for(const [key,tile] of this.tiles)tile.mesh.visible=this.displayedKeys.has(key);
  }
  this.group.visible=this.opacity>.001;
  for(const tile of this.tiles.values())(tile.mesh.material as THREE.MeshPhongMaterial).opacity=this.opacity;
  if(interacting||!allowDetails||distance>1.6||time-this.lastUpdate<.3)return;this.lastUpdate=time;
  const level=distance<1.09?7:distance<1.25?6:distance<1.7?5:4;
  const span=288/2**level,columns=Math.ceil(360/span),rows=Math.ceil(180/span);
  const direction=this.camera.position.clone().normalize();
  const lat=Math.asin(direction.y)*180/Math.PI,lon=Math.atan2(-direction.z,direction.x)*180/Math.PI;
  const row=Math.floor((90-lat)/span),col=Math.floor((lon+180)/span),key=`${level}/${row}/${col}`;
  if(key===this.lastKey)return;this.lastKey=key;
  this.requestedKeys.clear();
  for(let y=Math.max(0,row-2);y<=Math.min(rows-1,row+2);y++)for(let offset=-2;offset<=2;offset++){
   const x=(col+offset+columns)%columns,tileKey=`${level}/${y}/${x}`;
   this.requestedKeys.add(tileKey);
   if(this.tiles.has(tileKey)||this.pending.has(tileKey))continue;
   this.pending.add(tileKey);
   this.loader.load(`https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/${tileKey}.jpeg`,texture=>{
    if(this.disposed){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    this.uploads.push(()=>{
    this.pending.delete(tileKey);this.renderer.initTexture(texture);
    const geometry=this.tileGeometry(-180+x*span,90-y*span,span,1.0003+level*.00006);
    const material=new THREE.MeshPhongMaterial({map:texture,color:0x9bb3bd,shininess:0,transparent:true,opacity:0,depthWrite:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;
    this.tiles.set(tileKey,{mesh,level});this.group.add(mesh);
    if(this.tiles.size>125){const oldest=[...this.tiles.keys()].find(key=>!this.displayedKeys.has(key)&&!this.requestedKeys.has(key));if(oldest){const old=this.tiles.get(oldest)!;this.group.remove(old.mesh);old.mesh.geometry.dispose();const material=old.mesh.material as THREE.MeshPhongMaterial;material.map?.dispose();material.dispose();this.tiles.delete(oldest);}}
    });
   },undefined,()=>{this.pending.delete(tileKey);});
  }
 }
 private tileGeometry(west:number,north:number,span:number,radius:number){
  const segments=24,positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let row=0;row<=segments;row++)for(let col=0;col<=segments;col++){
   const point=coordinates(Math.max(-90,north-span*row/segments),west+span*col/segments,radius);
   positions.push(point.x,point.y,point.z);uv.push(col/segments,1-row/segments);
  }
  for(let row=0;row<segments;row++)for(let col=0;col<segments;col++){
   const a=row*(segments+1)+col,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
 }
 showArea(area:AreaShape){
  this.clearArea();const polygons=area.geometry.type==='Polygon'?[area.geometry.coordinates as PolygonCoordinates]:area.geometry.coordinates as PolygonCoordinates[];
  const canvas=document.createElement('canvas');canvas.width=4096;canvas.height=2048;const context=canvas.getContext('2d')!;
  context.fillStyle='rgba(239,197,114,0.32)';
  for(const polygon of polygons){
   context.beginPath();
   for(const ring of polygon){
    const points:THREE.Vector3[]=[];
    ring.forEach(([lon,lat],index)=>{
     const x=(lon+180)/360*canvas.width,y=(90-lat)/180*canvas.height;
     if(index===0)context.moveTo(x,y);else context.lineTo(x,y);
     if(index){const [previousLon,previousLat]=ring[index-1],steps=Math.max(1,Math.ceil(Math.max(Math.abs(lon-previousLon),Math.abs(lat-previousLat))/.2));for(let step=0;step<steps;step++)points.push(coordinates(THREE.MathUtils.lerp(previousLat,lat,step/steps),THREE.MathUtils.lerp(previousLon,lon,step/steps),1.0012));}
    });context.closePath();
    if(ring.length){const [lon,lat]=ring.at(-1)!;points.push(coordinates(lat,lon,1.0012));}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffd48b,transparent:true,opacity:.95}));this.highlight.add(line);
    for(const point of points)this.areaBounds.expandByPoint(point);
   }
   context.fill('evenodd');
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  this.highlight.add(new THREE.Mesh(new THREE.SphereGeometry(1.001,256,128),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.FrontSide})));
 }
 updateAreaVisibility(marker:THREE.Object3D,markerRadius:number,width:number,height:number){
  if(this.areaBounds.isEmpty())return;
  this.camera.updateMatrixWorld();
  const projected=new THREE.Vector3();
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  // Only the boundary contributes to these bounds, never the full-sphere fill mesh.
  for(const x of [this.areaBounds.min.x,this.areaBounds.max.x])for(const y of [this.areaBounds.min.y,this.areaBounds.max.y])for(const z of [this.areaBounds.min.z,this.areaBounds.max.z]){
   projected.set(x,y,z).project(this.camera);
   left=Math.min(left,projected.x);right=Math.max(right,projected.x);
   top=Math.min(top,projected.y);bottom=Math.max(bottom,projected.y);
  }
  const outlineSize=Math.max((right-left)*width/2,(bottom-top)*height/2);
  const center=marker.position.clone().project(this.camera);
  const cameraRight=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);
  const edge=marker.position.clone().addScaledVector(cameraRight,markerRadius).project(this.camera);
  const markerSize=Math.hypot((edge.x-center.x)*width,(edge.y-center.y)*height);
  // Keep similar-sized outlines hidden; fade them in once clearly larger than the marker.
  const opacity=THREE.MathUtils.smoothstep(outlineSize/Math.max(markerSize,1),1.5,2.2);
  this.highlight.visible=opacity>0;
  if(opacity===this.areaOpacity)return;
  this.areaOpacity=opacity;
  for(const child of this.highlight.children){
   if(child instanceof THREE.Line)(child.material as THREE.LineBasicMaterial).opacity=.95*opacity;
   else if(child instanceof THREE.Mesh)(child.material as THREE.MeshBasicMaterial).opacity=opacity;
  }
 }
 clearArea(){this.areaBounds.makeEmpty();this.areaOpacity=0;this.highlight.visible=false;for(const child of [...this.highlight.children]){this.highlight.remove(child);if(child instanceof THREE.Mesh||child instanceof THREE.Line){child.geometry.dispose();const material=child.material as THREE.MeshBasicMaterial;material.map?.dispose();material.dispose();}}}
 dispose(){this.disposed=true;this.clearArea();for(const upload of this.uploads)upload();this.uploads=[];for(const {mesh} of this.tiles.values()){mesh.geometry.dispose();const material=mesh.material as THREE.MeshPhongMaterial;material.map?.dispose();material.dispose();}this.scene.remove(this.group,this.highlight);}
}
