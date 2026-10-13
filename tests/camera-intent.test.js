import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createCharacter} from '../src/character.js';
import {freshGame,serialize} from '../src/game.js';
import {terrain} from '../src/world.js';
import {createMovementHeading} from '../src/movement-heading.js';
import {unobstructedCamera} from '../src/camera.js';

function viewAt(p,yaw,pitch){
  const h=Math.max(terrain(p.x,p.z),-.45),camera=new THREE.PerspectiveCamera();
  camera.position.set(p.x+Math.sin(yaw)*14,h+2.4+Math.tan(pitch)*14,p.z+Math.cos(yaw)*14);
  return {yaw,pitch,distance:14,camera,cameraObstacles:[],buildings:new Map(),creatures:new Map(),meadow:[],player:createCharacter(),fireLight:{position:new THREE.Vector3()},sun:{position:new THREE.Vector3(),target:{position:new THREE.Vector3()}},marker:new THREE.Object3D(),preview:new THREE.Group(),scene:new THREE.Scene(),renderer:{render(){}},updateIslanders(){},updateAtmosphere(){}};
}
test('temporary landmark avoidance cannot overwrite manual orbit or steer the next released gesture',()=>{
  const state=freshGame();Object.assign(state.player,{x:-86.9,z:-51.9});state.enemies=[];
  const requestedYaw=7*Math.PI/6,view=viewAt(state.player,requestedYaw,.08),before=serialize(state),heading=createMovementHeading();
  heading.begin(requestedYaw);const first=heading.relative(0,-1,view.yaw);heading.end();
  for(let frame=0;frame<120;frame++)WorldView.prototype.draw.call(view,state,null,null,false,1/60);
  assert.equal(view.yaw,requestedYaw,'collision orbit is temporary; manual request must remain intact');
  heading.begin(view.yaw);assert.deepEqual(heading.relative(0,-1,view.yaw),first);
  assert.equal(serialize(state),before,'rendering must not mutate ordinary game state');
  assert.ok(view.camera.position.toArray().every(Number.isFinite));
  view.yaw-=.3;const draggedYaw=view.yaw;
  WorldView.prototype.draw.call(view,state,null,null,false,1/60);
  assert.equal(view.yaw,draggedYaw,'a subsequent manual drag starts from the requested orbit');
});
test('an orbit temporarily moved around a tower returns to manual direction when the obstruction clears',()=>{
  const state=freshGame();state.enemies=[];Object.assign(state.player,{x:-86.9,z:-51.9});
  const yaw=7*Math.PI/6,view=viewAt(state.player,yaw,.08);
  for(let i=0;i<60;i++)WorldView.prototype.draw.call(view,state,null,null,false,1/60);
  Object.assign(state.player,{x:20,z:20});view.pitch=.88;
  for(let i=0;i<180;i++)WorldView.prototype.draw.call(view,state,null,null,false,1/60);
  const actual=Math.atan2(view.camera.position.x-state.player.x,view.camera.position.z-state.player.z);
  const delta=Math.atan2(Math.sin(actual-yaw),Math.cos(actual-yaw));
  assert.ok(Math.abs(delta)<1e-6,'clear terrain restores the requested orbit');
  assert.equal(view.yaw,yaw);
});

test('temporary avoidance retains an already clear side instead of jumping across the player',()=>{
  const focus=new THREE.Vector3(0,2.4,0),desired=new THREE.Vector3(0,6.4,14);
  const wall=new THREE.Box3(new THREE.Vector3(-2,0,1),new THREE.Vector3(2,25,6));
  const safe=unobstructedCamera(focus,desired,[wall],()=>0,6,Math.PI/2);
  assert.ok(safe.x>6&&Math.abs(safe.z)<1e-8,'an existing clear right orbit must win over the opposite left fallback');
  const hit=new THREE.Ray(focus,safe.clone().sub(focus).normalize()).intersectBox(wall,new THREE.Vector3());
  assert.ok(!hit||safe.distanceTo(focus)<hit.distanceTo(focus));
  assert.ok(unobstructedCamera(focus,desired,[],()=>0,6,Math.PI/2).distanceTo(desired)<1e-10,'a clear manual request remains authoritative');
});
