import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {freshGame,movePlayer,nearest,interact,build} from '../src/game.js';
import {LANDMARKS,terrain} from '../src/world.js';
const ruin=LANDMARKS.find(o=>o.type==='ruin');
function traveller(dx,dz){const s=freshGame();s.enemies=[];Object.assign(s.player,{x:ruin.x+dx,z:ruin.z+dz});return s;}

test('ruin supports block swept movement, while old overlaps still permit escape',()=>{
  const s=traveller(-3.2,0);movePlayer(s,[],0,-1,1);
  assert.ok(s.player.z>ruin.z-2,'a long step cannot tunnel through the left arch support');
  const inside=traveller(-3.2,-3);movePlayer(inside,[],-1,0,.2);
  assert.ok(inside.player.x<ruin.x-3.3,'a legacy save can leave the new support');
});
test('the arch opening and stele approach stay traversable and readable',()=>{
  const s=traveller(0,-7);for(let i=0;i<45;i++)movePlayer(s,[],0,1,1/60);
  assert.ok(s.player.z>ruin.z-2&&s.player.z<ruin.z+.5);
  const target=nearest(s,[]);assert.equal(target.id,ruin.id);assert.match(interact(s,target),/群岛不因海峡/);
});
test('sculpted ruin keeps individual camera boxes, an open arch and a bounded merged budget',async()=>{
  const {createRuin}=await import('../src/ruin.js');const model=createRuin(ruin,terrain);
  assert.ok(model.userData.cameraBoxes.length>15);
  const base=terrain(ruin.x,ruin.z),focus=new THREE.Vector3(0,2.4,-7),ray=new THREE.Ray(focus,new THREE.Vector3(0,0,1));
  assert.ok(model.userData.cameraBoxes.every(b=>{const hit=ray.intersectBox(b,new THREE.Vector3());return !hit||hit.distanceTo(focus)>7;}),'camera ray passes through the arch below its lintel');
  assert.ok(model.children.length<=3);let triangles=0;
  model.traverse(m=>{if(!m.isMesh)return;assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));assert.ok(m.geometry.attributes.normal.array.every(Number.isFinite));assert.ok(m.geometry.attributes.color.array.every(Number.isFinite));triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
  assert.ok(triangles>1000&&triangles<15000);assert.ok(new THREE.Box3().setFromObject(model).max.y<12);assert.ok(base>0);
});

test('construction leaves clearance around expanded ruin footings and does not spend rejected materials',()=>{
  const s=traveller(7.39103626,3.06146746);Object.assign(s.inventory,{wood:20,stone:20});const before={...s.inventory};
  assert.match(build(s,[],'workbench',s.player.x,s.player.z),/现有建筑或人物太近/);
  assert.deepEqual(s.inventory,before);assert.equal(s.buildings.length,0);
});
