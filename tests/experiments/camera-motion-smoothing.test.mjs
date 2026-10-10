import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.min.js';
import {advanceCamera,unobstructedCamera} from './camera-motion-smoothing.mjs';
const focus=new THREE.Vector3(0,2.4,0),desired=new THREE.Vector3(0,3,20),flat=()=>0;
test('camera retracts before a blocking rock and returns to requested distance when clear',()=>{
  const rock=new THREE.Box3(new THREE.Vector3(-3,0,8),new THREE.Vector3(3,5,12));
  const safe=unobstructedCamera(focus,desired,[rock],flat);
  assert.ok(safe.z<8&&safe.z>7);assert.ok(!rock.containsPoint(safe));
  assert.deepEqual(unobstructedCamera(focus,desired,[],flat).toArray(),desired.toArray());
  const behind=new THREE.Box3(new THREE.Vector3(-3,0,-12),new THREE.Vector3(3,5,-8));
  assert.deepEqual(unobstructedCamera(focus,desired,[behind],flat).toArray(),desired.toArray());
});

test('camera escapes a close wall gradually at different frame rates without crossing it',()=>{
  const wall=new THREE.Box3(new THREE.Vector3(-2,0,1),new THREE.Vector3(2,6,6));
  for(const fps of [30,60,144]){
    let yaw=0,position=unobstructedCamera(focus,desired,[wall],flat);
    for(let frame=0;frame<fps*2;frame++){
      const target=desired.clone().sub(focus).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(focus);
      const next=advanceCamera(focus,target,position,yaw,[wall],flat,1/fps,4);
      const turn=Math.abs(Math.atan2(Math.sin(next.yaw-yaw),Math.cos(next.yaw-yaw)));
      assert.ok(turn<=3/fps+1e-8,`${fps}fps automatic turn must not teleport`);
      assert.ok(next.position.distanceTo(position)<3,`${fps}fps camera must not jump across the scene`);
      const ray=new THREE.Ray(focus,next.position.clone().sub(focus).normalize()),hit=ray.intersectBox(wall,new THREE.Vector3());
      assert.ok(!hit||focus.distanceTo(hit)>focus.distanceTo(next.position),'smoothed camera stays on the player side');
      yaw=next.yaw;position=next.position;
    }
    assert.ok(position.distanceTo(focus)>4,'gradual escape must recover framing instead of remaining at the head');
  }
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
