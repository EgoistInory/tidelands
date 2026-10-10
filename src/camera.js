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
