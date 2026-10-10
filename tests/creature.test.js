import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCreature,animateCreature} from '../src/creature.js';

test('crab has eight walking legs and its articulated pincers close during a strike',()=>{
  const crab=createCreature('crab'),u=crab.userData;
  assert.equal(u.legs.length,8);
  assert.equal(u.claws.length,2);
  const tips=()=>u.claws.map(claw=>{
    const pincer=claw.userData.pincer;
    assert.ok(pincer,'each claw needs a separate movable finger');
    const fixed=claw.localToWorld(new THREE.Vector3(claw.userData.side*.22,-.01,1.11));
    const moving=pincer.localToWorld(new THREE.Vector3(claw.userData.side*.02,0,.47));
    return fixed.distanceTo(moving);
  });
  const enemy={x:0,z:0,hp:70,attackAt:-100};
  animateCreature(crab,enemy,10,1/60,0,{x:0,z:10});crab.updateMatrixWorld(true);
  const open=tips();assert.ok(open.every(gap=>gap>.18));
  animateCreature(crab,{...enemy,attackAt:10},10.175,1/60,0,{x:0,z:10});crab.updateMatrixWorld(true);
  const closed=tips();assert.ok(closed.every((gap,i)=>gap<open[i]*.25));
  animateCreature(crab,enemy,11,1/60,0,{x:0,z:10});crab.updateMatrixWorld(true);
  assert.ok(tips().every((gap,i)=>Math.abs(gap-open[i])<1e-6));
});

for(const type of ['boar','crab'])test(`${type}: sculpted surfaces stay finite and retain the same distant silhouette`,()=>{
  const creature=createCreature(type),bounds=new THREE.Box3().setFromObject(creature.userData.body);
  assert.ok(bounds.min.y>=-.03&&bounds.max.y<2.6,'model must fit its established ground/height scale');
  let triangles=0;
  creature.traverse(part=>{
    if(!part.isMesh)return;
    for(const attribute of Object.values(part.geometry.attributes))assert.ok([...attribute.array].every(Number.isFinite));
    if(part.geometry.index)assert.ok([...part.geometry.index.array].every(i=>i<part.geometry.attributes.position.count));
    if(part.parent!==creature.userData.distant)triangles+=(part.geometry.index?.count??part.geometry.attributes.position.count)/3;
  });
  assert.ok(triangles<15000,'two native procedural models need a bounded geometry budget');
  const distant=new THREE.Box3().setFromObject(creature.userData.distant);
  assert.ok(bounds.min.distanceTo(distant.min)<1e-5&&bounds.max.distanceTo(distant.max)<1e-5);
});
for(const type of ['boar','crab'])test(`${type}: distance gait, bounded turn, hit isolation and death recovery`,()=>{
  const a=createCreature(type),b=createCreature(type),e={x:0,z:0,hp:70,attackAt:-100},target={x:0,z:8};
  const draw=(enemy,time)=>animateCreature(a,enemy,time,.016,2,target);
  draw(e,10);draw(e,11);assert.equal(a.userData.phase,0);
  draw({...e,x:.2},12);assert.ok(a.userData.phase>0);assert.ok(a.rotation.y>0&&a.rotation.y<Math.PI/2);
  assert.ok(a.userData.legs.some(l=>Math.abs(l.rotation.x)+Math.abs(l.rotation.z)>0));
  draw({...e,x:.2,hp:30},12.1);assert.ok(a.userData.hide.emissive.r>0);assert.equal(b.userData.hide.emissive.r,0);
  draw({...e,hp:0},12.2);assert.equal(a.visible,true);draw({...e,hp:0},12.8);assert.equal(a.visible,false);
  draw(e,13);assert.equal(a.visible,true);assert.equal(a.userData.body.rotation.z,0);
  const loaded=createCreature(type);animateCreature(loaded,{...e,hp:0},20,.016,0,target);assert.equal(loaded.visible,false);
});

for(const type of ['boar','crab'])test(`${type}: distant batching keeps bounds and uses hysteresis without suppressing animation`,()=>{
  const c=createCreature(type),u=c.userData,e={x:0,z:0,hp:70,attackAt:-100};
  const nearBounds=new THREE.Box3().setFromObject(u.body),farBounds=new THREE.Box3().setFromObject(u.distant);
  assert.ok(nearBounds.min.distanceTo(farBounds.min)<1e-5);assert.ok(nearBounds.max.distanceTo(farBounds.max)<1e-5);
  assert.ok(u.distant.children.length<=3);
  const draw=(range,time=10,enemy=e)=>animateCreature(c,enemy,time,.016,0,{x:range,z:0});
  draw(121);assert.equal(u.distant.visible,true);assert.equal(u.body.visible,false);
  draw(110);assert.equal(u.distant.visible,true);
  draw(99);assert.equal(u.body.visible,true);
  draw(110);assert.equal(u.body.visible,true);
  draw(130,11,{...e,x:.1});assert.equal(u.body.visible,true);
  draw(130,12,{...e,x:.1});assert.equal(u.distant.visible,true);
  draw(130,12.1,{...e,x:.1,hp:30});assert.equal(u.body.visible,true);
  draw(130,12.2,{...e,x:.1,hp:0});assert.equal(u.body.visible,true);
  draw(130,13,{...e,x:.1,hp:0});assert.equal(c.visible,false);
});
