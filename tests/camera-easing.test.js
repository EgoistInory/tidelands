import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {smoothCamera} from '../src/camera.js';
const focus=new THREE.Vector3(0,2.4,0),flat=()=>0;
test('an orbit turn follows an arc without cutting through the player or snapping to the target',()=>{
  const current=focus.clone().add(new THREE.Vector3(0,4,14)),desired=focus.clone().add(new THREE.Vector3(0,4,-14));
  const next=smoothCamera(focus,current,desired,[],flat,1/60);
  assert.ok(next.distanceTo(current)>0&&next.distanceTo(current)<6.1);
  assert.ok(next.distanceTo(focus)>14,'180-degree input must not collapse camera distance through the player');
  assert.ok(next.distanceTo(desired)>10);assert.deepEqual(current.toArray(),[0,6.4,14]);
});
test('angle wrapping follows the short arc and easing has equivalent results at different frame rates',()=>{
  const orbit=yaw=>focus.clone().add(new THREE.Vector3(Math.sin(yaw)*14,4,Math.cos(yaw)*14));
  const wrapped=smoothCamera(focus,orbit(Math.PI-.01),orbit(-Math.PI+.01),[],flat,1/60);
  assert.ok(wrapped.distanceTo(orbit(Math.PI-.01))<.1);
  const ends=[];
  for(const fps of [30,60,144]){let current=orbit(0);for(let frame=0;frame<fps;frame++)current=smoothCamera(focus,current,orbit(1.5),[],flat,1/fps);ends.push(current);}
  assert.ok(ends[0].distanceTo(ends[1])<1e-8);assert.ok(ends[1].distanceTo(ends[2])<1e-8);
});
test('smoothing still retracts before solid scenery and terrain, including a zero-distance prior pose',()=>{
  const wall=new THREE.Box3(new THREE.Vector3(-3,0,3),new THREE.Vector3(3,8,7));
  const current=new THREE.Vector3(0,5,12),desired=new THREE.Vector3(1,5,14);
  const next=smoothCamera(focus,current,desired,[wall],flat,1/60);
  const hit=new THREE.Ray(focus,next.clone().sub(focus).normalize()).intersectBox(wall,new THREE.Vector3());
  assert.ok(!wall.containsPoint(next));assert.ok(!hit||next.distanceTo(focus)<hit.distanceTo(focus));
  const ridge=(_,z)=>z>4&&z<8?9:0;
  const terrainSafe=smoothCamera(focus,current,desired,[],ridge,1/60);assert.ok(terrainSafe.z<=4);
  const recovered=smoothCamera(focus,focus,desired,[],flat,1/60);assert.ok(recovered.toArray().every(Number.isFinite));assert.ok(recovered.distanceTo(focus)>0);
});

test('an open side of a nearby tower keeps framing while a smoothed arc crosses its blocked side',()=>{
  const wall=new THREE.Box3(new THREE.Vector3(-2,0,1),new THREE.Vector3(2,25,6));
  const current=new THREE.Vector3(0,6.4,14),desired=new THREE.Vector3(-14,6.4,0);
  const next=smoothCamera(focus,current,desired,[wall],flat,1/60,6);
  assert.ok(next.distanceTo(focus)>=6,'smoothing must not introduce a near-head pose when an open framed direction exists');
  const hit=new THREE.Ray(focus,next.clone().sub(focus).normalize()).intersectBox(wall,new THREE.Vector3());
  assert.ok(!hit||next.distanceTo(focus)<hit.distanceTo(focus));
});
