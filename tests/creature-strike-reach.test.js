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

test('boar loads back before contact, then drives the muzzle forward over planted feet',()=>{
  const ground=(x,z)=>4+.13*x+.17*z;
  const root=createCreature('boar'),enemy={x:0,z:0,hp:70},target={x:0,z:2.5};
  const muzzle=new THREE.Vector3(0,1.03,1.995);
  const pose=(time,attack)=> {
    animateCreature(root,enemy,time,1/120,4,target,attack,ground);
    return root.userData.body.localToWorld(muzzle.clone());
  };
  let rest;
  for(let i=0;i<24;i++)rest=pose(9.8+i/120,null);
  let previous=rest,load,impact,planted=0;
  const plan={at:10,yaw:0};
  for(let i=0;i<=72;i++){
    const point=pose(10+i/120,plan);
    assert(point.distanceTo(previous)<.075,'the muzzle should ease between phases');
    previous=point;
    if(i===16)load=point;
    if(i===36)impact=point;
    const {worldFeet,footContacts}=root.userData;
    for(const [index,foot] of worldFeet.entries())if(footContacts[index]){
      assert(Math.abs(foot.y-ground(foot.x,foot.z))<.015);
      planted++;
    }
  }
  assert(load.z<rest.z-.12&&load.y<rest.y-.1,'windup should load back and down');
  assert(impact.z>rest.z+.22&&impact.z>load.z+.46,'contact must follow the visible drive');
  assert(planted>160,'the visual shift must retain real contact through the strike');
  assert(Math.abs(previous.z-rest.z)<.02,'the muzzle should return to its resting reach');
  assert.deepEqual(root.position.toArray(),[0,4,0]);
});
