import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {unobstructedCamera} from '../src/camera.js';
const focus=new THREE.Vector3(0,2.4,0),desired=new THREE.Vector3(0,3,20),flat=()=>0;
test('camera retracts before a blocking rock and returns to requested distance when clear',()=>{
  const rock=new THREE.Box3(new THREE.Vector3(-3,0,8),new THREE.Vector3(3,5,12));
  const safe=unobstructedCamera(focus,desired,[rock],flat);
  assert.ok(safe.z<8&&safe.z>7);assert.ok(!rock.containsPoint(safe));
  assert.deepEqual(unobstructedCamera(focus,desired,[],flat).toArray(),desired.toArray());
  const behind=new THREE.Box3(new THREE.Vector3(-3,0,-12),new THREE.Vector3(3,5,-8));
  assert.deepEqual(unobstructedCamera(focus,desired,[behind],flat).toArray(),desired.toArray());
});
test('camera avoids intervening terrain even when its destination is above ground',()=>{
  const ridge=(_,z)=>z>8&&z<12?6:0;
  const safe=unobstructedCamera(focus,desired,[],ridge);
  assert.ok(safe.z<=8);assert.ok(safe.y>ridge(safe.x,safe.z));
  assert.deepEqual(unobstructedCamera(focus,focus,[],flat).toArray(),focus.toArray());
});

test('close scenery turns the framed camera into clear space instead of the player head',()=>{
  const wall=new THREE.Box3(new THREE.Vector3(-2,0,1),new THREE.Vector3(2,6,6));
  const safe=unobstructedCamera(focus,desired,[wall],flat,4);
  assert.ok(safe.distanceTo(focus)>=4,'near-wall camera should use an open side of the player');
  assert.ok(!wall.containsPoint(safe));
  const path=new THREE.Ray(focus,safe.clone().sub(focus).normalize()),hit=path.intersectBox(wall,new THREE.Vector3());
  assert.ok(!hit||focus.distanceTo(hit)>focus.distanceTo(safe),'camera must stay on the player side of the wall');
  assert.deepEqual(unobstructedCamera(focus,desired,[],flat,4).toArray(),desired.toArray());
  const enclosed=[
    new THREE.Box3(new THREE.Vector3(-3,0,1),new THREE.Vector3(3,6,3)),
    new THREE.Box3(new THREE.Vector3(-3,0,-3),new THREE.Vector3(3,6,-1)),
    new THREE.Box3(new THREE.Vector3(1,0,-3),new THREE.Vector3(3,6,3)),
    new THREE.Box3(new THREE.Vector3(-3,0,-3),new THREE.Vector3(-1,6,3))
  ];
  const trapped=unobstructedCamera(focus,desired,enclosed,flat,4);
  assert.ok(trapped.distanceTo(focus)<1,'an enclosed space must not bypass collision to reach framing distance');
});
