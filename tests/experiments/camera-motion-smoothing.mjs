import * as THREE from '../../vendor/three.module.min.js';

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

export function advanceCamera(focus,desired,position,yaw,boxes,heightAt,dt,minimumDistance=6){
  const safe=unobstructedCamera(focus,desired,boxes,heightAt,minimumDistance);
  const safeYaw=Math.atan2(safe.x-focus.x,safe.z-focus.z);
  const turn=Math.atan2(Math.sin(safeYaw-yaw),Math.cos(safeYaw-yaw)),step=Math.max(-3*dt,Math.min(3*dt,turn));
  // Limit forced orbit changes; check every intermediate ray before smoothing the position.
  const intermediate=desired.clone().sub(focus).applyAxisAngle(new THREE.Vector3(0,1,0),step).add(focus);
  yaw+=step;
  const target=unobstructedCamera(focus,intermediate,boxes,heightAt);
  const previous=position.clone().sub(focus),offset=target.clone().sub(focus),amount=1-Math.exp(-dt*8);
  const previousYaw=Math.atan2(previous.x,previous.z),angle=Math.atan2(Math.sin(yaw-previousYaw),Math.cos(yaw-previousYaw));
  const renderedYaw=previousYaw+Math.max(-3*dt,Math.min(3*dt,angle));
  const previousPitch=Math.atan2(previous.y,Math.hypot(previous.x,previous.z)),pitch=Math.atan2(offset.y,Math.hypot(offset.x,offset.z));
  const renderedPitch=previousPitch+(pitch-previousPitch)*amount;
  const radius=previous.length()+Math.max(-24*dt,Math.min(24*dt,(offset.length()-previous.length())*amount));
  // Interpolate the orbit, not its chord: a chord can cut through the corner of a wall.
  position=new THREE.Vector3(Math.sin(renderedYaw)*Math.cos(renderedPitch),Math.sin(renderedPitch),Math.cos(renderedYaw)*Math.cos(renderedPitch)).multiplyScalar(radius).add(focus);
  return {yaw,position:unobstructedCamera(focus,position,boxes,heightAt)};
}
