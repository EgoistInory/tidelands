import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {unobstructedCamera} from '../src/camera.js';
import {createMovementHeading} from '../src/movement-heading.js';

test('automatic scenery avoidance cannot steer a held forward input',()=>{
  const heading=createMovementHeading(),focus=new THREE.Vector3(0,2.4,0);
  heading.begin(0);
  const obstacle=new THREE.Box3(new THREE.Vector3(-2,0,1),new THREE.Vector3(2,25,6));
  const safe=unobstructedCamera(focus,new THREE.Vector3(0,6.4,14),[obstacle],()=>0,6);
  const avoidedYaw=Math.atan2(safe.x,safe.z);
  assert.ok(Math.abs(avoidedYaw)>.1,'actual avoidance turns the camera');
  const v=heading.relative(0,-1,avoidedYaw);
  assert.deepEqual(v,{x:0,z:-1});
  heading.end();
  const next=heading.relative(0,-1,avoidedYaw);
  assert.ok(Math.abs(next.x)>.1,'a new input follows the currently visible camera');
});

test('adding another direction or adjusting an active stick retains the captured view basis',()=>{
  const heading=createMovementHeading();heading.begin(.15);heading.begin(Math.PI);
  const diagonal=heading.relative(1,-1,Math.PI),side=heading.relative(1,0,Math.PI);
  assert.ok(diagonal.x>0&&diagonal.z<0);assert.ok(side.x>.9&&side.z<0);
  heading.end(true);assert.deepEqual(heading.relative(1,0,Math.PI),side);
  heading.end();heading.begin(Math.PI);assert.ok(heading.relative(1,0,0).x<-.9);
});

test('an intentional camera drag steers held movement while release or pause resets its basis',()=>{
  const heading=createMovementHeading();heading.begin(0);heading.turn(-Math.PI/2);
  const v=heading.relative(0,-1,0);assert.ok(v.x>.999&&Math.abs(v.z)<1e-12);
  heading.end();heading.turn(1);heading.begin(0);assert.deepEqual(heading.relative(0,-1,2),{x:0,z:-1});
});
