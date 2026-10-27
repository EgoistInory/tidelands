import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createWorld} from '../src/world.js';
import {freshGame} from '../src/game.js';
import {bindCoastalVisual} from '../src/coastal.js';
function fixture(){
  const world=createWorld(),frozen=JSON.stringify(world),scene=new THREE.Scene(),view={world,scene,batches:[],cameraObstacles:[],camera:new THREE.PerspectiveCamera()};let released=0;
  const geometry=new THREE.BoxGeometry(1,2,1),material=new THREE.MeshStandardMaterial(),near=new THREE.Group(),mid=new THREE.Group();near.add(new THREE.Mesh(geometry,material));mid.add(new THREE.Mesh(geometry,material));
  const model={near,mid,farGeometry:new THREE.PlaneGeometry(1,2),farMaterials:Array.from({length:4},()=>new THREE.MeshStandardMaterial()),center:new THREE.Vector3(),boxes:[[[0,0,0],[1,2,1]]],minY:0};
  const prepared={models:[model,model,model],release(){released++;}};
  return {world,frozen,scene,view,prepared,get released(){return released;}};
}
test('production binding preserves resource records and bounds expensive visual nodes',()=>{
  const f=fixture(),coastal=bindCoastalVisual(f.view,f.prepared),state=freshGame();Object.assign(state.player,{x:-123,z:128});coastal.update(state);
  assert.equal(coastal.trees.length,133);assert.equal(JSON.stringify(f.world),f.frozen);assert(coastal.trees.filter(t=>t.level==='near').length<=1);assert(coastal.trees.filter(t=>t.level==='mid').length<=3);assert.equal(f.view.cameraObstacles.length,133);
  for(const tree of coastal.trees)state.depleted[tree.node.id]=state.time+150;coastal.update(state);assert(coastal.trees.every(t=>!t.root.visible));assert(coastal.farBatches.every(b=>b.count===0));coastal.release();
});
test('production coastal release removes owned scene nodes exactly once',()=>{
  const f=fixture(),coastal=bindCoastalVisual(f.view,f.prepared);assert(f.scene.children.length>133);coastal.release();assert.equal(f.scene.children.length,0);coastal.release();assert.equal(f.released,1);
});
