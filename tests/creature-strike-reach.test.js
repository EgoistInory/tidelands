import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCreature,animateCreature} from '../src/creature.js';
import {ENEMY_ATTACK_DURATION,ENEMY_ATTACK_IMPACT} from '../src/action-timing.js';

function fixture(){
  const root=createCreature('crab'),enemy={x:0,z:0,hp:40,attackAt:-100},target={x:0,z:2.3};
  const pose=(time,at=10)=>{animateCreature(root,{...enemy,attackAt:at},time,1/60,0,target);root.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const claw of root.userData.claws)bounds.union(new THREE.Box3().setFromObject(claw,true));return bounds;};
  return {root,pose};
}

test('crab raises its claws before damage and reaches the contacting body at impact',()=>{
  const {pose}=fixture(),rest=pose(9,-100),windup=pose(10+ENEMY_ATTACK_IMPACT/2),impact=pose(10+ENEMY_ATTACK_IMPACT);
  assert(windup.max.y>rest.max.y+.35,'wind-up must remain visibly raised');
  assert(impact.max.z>rest.max.z+.1,`impact must extend forward rather than withdraw: rest ${rest.max.z}, impact ${impact.max.z}`);
  assert(impact.max.z>=2,'at2.3m centres the target body begins at2m; the claws must reach it at damage');
});

test('complete crab strike keeps claw geometry above ground, freezes at a held clock and returns to rest',()=>{
  const {root,pose}=fixture(),rest=pose(9,-100);let previous=null,maxStep=0;
  for(let i=0;i<=120;i++){
    const time=10+ENEMY_ATTACK_DURATION*i/120,box=pose(time);
    assert(box.min.y>.1,'claws must not dig through the floor');
    const point=root.userData.claws[0].localToWorld(new THREE.Vector3(-.22,-.01,1.11));
    if(previous)maxStep=Math.max(maxStep,point.distanceTo(previous));previous=point;
  }
  assert(maxStep<.15,'stroke must not snap between wind-up, contact and recovery');
  const held=pose(10+ENEMY_ATTACK_IMPACT);assert(held.equals(pose(10+ENEMY_ATTACK_IMPACT)));
  const recovered=pose(11,-100);assert(Math.abs(recovered.min.z-rest.min.z)<.01&&Math.abs(recovered.max.z-rest.max.z)<.01);
});
