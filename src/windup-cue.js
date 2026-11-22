import * as THREE from '../vendor/three.module.min.js';
import {ENEMY_ATTACK_IMPACT} from './action-timing.js';

// A single terrain strip marks the locked direction of the closest active windup.
export function createWindupCue(heightAt){
  const segments=18,positions=new THREE.BufferAttribute(new Float32Array((segments+1)*6),3);
  positions.setUsage(THREE.DynamicDrawUsage);
  const geometry=new THREE.BufferGeometry(),indices=[];
  for(let i=0;i<segments;i++){
    const vertex=i*2;
    indices.push(vertex,vertex+1,vertex+2,vertex+1,vertex+3,vertex+2);
  }
  geometry.setAttribute('position',positions);geometry.setIndex(indices);
  const material=new THREE.MeshBasicMaterial({color:0xf0a45c,side:THREE.DoubleSide,transparent:true,depthWrite:false});
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='enemy-windup-direction';
  mesh.visible=false;mesh.frustumCulled=false;
  let previousX,previousZ,previousYaw;

  function update(threat,time){
    const age=time-(threat?.pose.at??Infinity);
    mesh.visible=Boolean(threat&&threat.enemy.hp>0&&!threat.pose.resolved&&age>=0&&age<ENEMY_ATTACK_IMPACT);
    if(!mesh.visible)return;
    material.opacity=.56+.29*age/ENEMY_ATTACK_IMPACT;
    const {enemy:{x,z},pose:{yaw}}=threat;
    if(x===previousX&&z===previousZ&&yaw===previousYaw)return;
    for(let i=0;i<=segments;i++){
      const t=i/segments,angle=yaw+(t-.5)*1.92;
      const inner=2.34-.29*Math.sin(t*Math.PI),outer=2.48;
      for(const [side,radius] of [inner,outer].entries()){
        const px=x+Math.sin(angle)*radius,pz=z+Math.cos(angle)*radius;
        positions.setXYZ(2*i+side,px,heightAt(px,pz)+.07,pz);
      }
    }
    positions.needsUpdate=true;
    previousX=x;previousZ=z;previousYaw=yaw;
  }
  function dispose(){geometry.dispose();material.dispose();}
  return {mesh,update,dispose};
}
