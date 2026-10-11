import * as THREE from '../vendor/three.module.min.js';

// Keep the camera on the player's side of solid scenery, including its near plane.
export function unobstructedCamera(focus,desired,boxes,heightAt,minimumDistance=0){
  const delta=desired.clone().sub(focus),length=delta.length();
  if(length<.001)return desired.clone();
  const ray=new THREE.Ray(focus,delta.divideScalar(length)),hit=new THREE.Vector3();
  let distance=length;
  for(const box of boxes){
    if(box.containsPoint(focus))continue;
    if(ray.intersectBox(box,hit))distance=Math.min(distance,Math.max(.25,focus.distanceTo(hit)-.5));
  }
  for(let d=.5;d<distance;d+=.5){ray.at(d,hit);if(hit.y<heightAt(hit.x,hit.z)+.4){distance=Math.max(.25,d-.5);break;}}
  let safe=ray.at(distance,new THREE.Vector3());
  if(distance<minimumDistance){
    const offset=desired.clone().sub(focus),up=new THREE.Vector3(0,1,0);
    // Try the closest orbit angles first; collision remains authoritative in enclosed spaces.
    for(let step=1;step<=6;step++)for(const side of [-1,1]){
      const candidate=unobstructedCamera(focus,offset.clone().applyAxisAngle(up,side*step*Math.PI/6).add(focus),boxes,heightAt);
      const candidateDistance=candidate.distanceTo(focus);
      if(candidateDistance>distance){safe=candidate;distance=candidateDistance;}
      if(distance>=minimumDistance)return safe;
    }
  }
  return safe;
}

export function smoothCamera(focus,current,desired,boxes,heightAt,dt,minimumDistance=0){
  const from=new THREE.Spherical().setFromVector3(current.clone().sub(focus)),to=new THREE.Spherical().setFromVector3(desired.clone().sub(focus));
  if(from.radius<.001)return unobstructedCamera(focus,desired,boxes,heightAt,minimumDistance);
  const blend=1-Math.exp(-Math.max(0,Math.min(.1,dt))*8);
  const turn=Math.atan2(Math.sin(to.theta-from.theta),Math.cos(to.theta-from.theta));
  from.theta+=turn*blend;from.phi=THREE.MathUtils.lerp(from.phi,to.phi,blend);from.radius=THREE.MathUtils.lerp(from.radius,to.radius,blend);
  const next=new THREE.Vector3().setFromSpherical(from).add(focus);
  return unobstructedCamera(focus,next,boxes,heightAt,minimumDistance);
}
