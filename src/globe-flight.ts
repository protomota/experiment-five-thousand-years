import * as THREE from 'three';

export function isGlobeDestinationVisible(camera:THREE.PerspectiveCamera,destination:THREE.Vector3){
 const surface=destination.clone().normalize().multiplyScalar(1.002);
 if(surface.dot(camera.position.clone().sub(surface))<=0)return false;
 camera.updateMatrixWorld();
 const projected=surface.project(camera);
 return Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1&&Math.abs(projected.z)<=1;
}

export function createGlobeFlight(start:THREE.Vector3,destination:THREE.Vector3,direct=false){
 const direction=start.clone().normalize(),end=destination.clone().normalize();
 const angle=direction.angleTo(end);
 return {
  direction,
  rotation:new THREE.Quaternion().setFromUnitVectors(direction,end),
  startDistance:start.length(),
  peakDistance:Math.max(start.length(),destination.length(),1.15+2.55*Math.sqrt(angle/Math.PI)),
  duration:direct?.9:angle<.003?.9:1.6+1.2*angle/Math.PI,
  stationary:angle<.003,
  direct,
 };
}

export function sampleGlobeFlight(flight:ReturnType<typeof createGlobeFlight>,destination:THREE.Vector3,progress:number,output:THREE.Vector3){
 const ease=(from:number,to:number)=>THREE.MathUtils.smoothstep(progress,from,to);
 if(flight.direct)return output.copy(flight.direction)
  .applyQuaternion(new THREE.Quaternion().slerp(flight.rotation,ease(0,1)))
  .multiplyScalar(THREE.MathUtils.lerp(flight.startDistance,Math.min(flight.startDistance,destination.length()),ease(0,1)));
 if(flight.stationary)return output.copy(destination).normalize().multiplyScalar(THREE.MathUtils.lerp(flight.startDistance,destination.length(),ease(0,1)));
 // Pull back first, turn along the shortest arc, then descend at the destination.
 const peak=Math.max(flight.peakDistance,destination.length());
 const distance=progress<.25
  ?THREE.MathUtils.lerp(flight.startDistance,peak,ease(0,.25))
  :THREE.MathUtils.lerp(peak,destination.length(),ease(.72,1));
 return output.copy(flight.direction)
  .applyQuaternion(new THREE.Quaternion().slerp(flight.rotation,ease(.2,.72)))
  .multiplyScalar(distance);
}
