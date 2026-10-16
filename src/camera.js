import * as THREE from '../vendor/three.module.min.js';

// Keep the camera on the player's side of solid scenery, including its near plane.
export function unobstructedCamera(focus,desired,boxes,heightAt,minimumDistance=0,preferredYaw=null){
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
    // Retain an already clear side while blocked; a clear manual request still wins above.
    const turns=[];for(const degrees of [2,4,6,8,10,12,16,20,24,30,45,60,90,120,150,180])for(const side of [-1,1])turns.push(side*degrees*Math.PI/180);
    if(Number.isFinite(preferredYaw)){
      const yaw=Math.atan2(offset.x,offset.z),preferred=Math.atan2(Math.sin(preferredYaw-yaw),Math.cos(preferredYaw-yaw));
      turns.unshift(preferred);turns.sort((a,b)=>Math.abs(Math.atan2(Math.sin(a-preferred),Math.cos(a-preferred)))-Math.abs(Math.atan2(Math.sin(b-preferred),Math.cos(b-preferred))));
    }
    for(const turn of turns){
      const candidate=unobstructedCamera(focus,offset.clone().applyAxisAngle(up,turn).add(focus),boxes,heightAt);
      const candidateDistance=candidate.distanceTo(focus);
      if(candidateDistance>distance){safe=candidate;distance=candidateDistance;}
      if(distance>=minimumDistance)return safe;
    }
    // If every side is covered, seek a lower clear ray below the crown before moving into the subject.
    if(offset.y>0)for(const ratio of [.75,.5,.25,0]){
      const lowered=new THREE.Vector3(offset.x,offset.y*ratio,offset.z).add(focus);
      const candidate=unobstructedCamera(focus,lowered,boxes,heightAt),candidateDistance=candidate.distanceTo(focus);
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
  return unobstructedCamera(focus,next,boxes,heightAt,minimumDistance,Math.atan2(current.x-focus.x,current.z-focus.z));
}
