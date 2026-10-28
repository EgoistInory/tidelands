import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createWorld} from '../src/world.js';
import {freshGame} from '../src/game.js';
import {footprintBoxes} from '../src/resource-footprint.js';
import {bindInlandVisual} from '../src/inland.js';
function fixture(){
 const world=createWorld(),nodes=world.objects.filter(o=>o.type==='tree').slice(0,2),scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(1,3,1),material=new THREE.MeshStandardMaterial(),model=new THREE.Group();model.add(new THREE.Mesh(geometry,material));let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
 const batch=new THREE.InstancedMesh(geometry,material,2),record={batch,entries:nodes,part:new THREE.Matrix4(),hidden:new Set()};nodes.forEach((node,i)=>batch.setMatrixAt(i,new THREE.Matrix4().makeTranslation(node.x,node.y,node.z)));scene.add(batch);
 const obstacles=[{object:nodes[0],boxes:[new THREE.Box3()]},{object:{id:'keep',type:'stone',x:50,z:50},box:new THREE.Box3()}],view={world,scene,batches:[record],cameraObstacles:obstacles,camera:new THREE.PerspectiveCamera()},poses=nodes.map(node=>({id:node.id,pose:[node.x,node.y,node.z,node.scale,node.rotation],frame:{x:node.x,y:node.y,z:node.z,rotation:0,scale:1}})),plane=new THREE.PlaneGeometry(1,3),materials=Array.from({length:4},()=>new THREE.MeshStandardMaterial()),prepared={data:{unit:1,bodyBoxes:[[[0,0,0],[1,3,1]]],cameraBoxes:[[[0,0,0],[1,3,1]]],placements:poses},layout:{frames:[{center:[0,1.5,0]}]},model,plane,materials,release(){geometry.dispose();material.dispose();plane.dispose();materials.forEach(m=>m.dispose());}};
 return {view,nodes,prepared,record,obstacles,get disposed(){return disposed;}};
}
test('inland release removes wood physics and owned visuals while restoring original live instances',()=>{
 const f=fixture(),state=freshGame(),before=JSON.stringify(f.view.world.objects),matrix=new THREE.Matrix4(),original=f.record.batch.instanceMatrix.array.slice(),bound=bindInlandVisual(f.view,f.prepared);bound.update(state);bound.afterSync();assert(footprintBoxes(f.nodes[0]));assert.equal(f.record.batch.instanceMatrix.array[0],0);assert.equal(typeof bound.release,'function');bound.release();bound.release();assert.equal(footprintBoxes(f.nodes[0]),null);assert.equal(footprintBoxes(f.nodes[1]),null);assert.deepEqual(f.record.batch.instanceMatrix.array,original);assert.equal(f.view.cameraObstacles,f.obstacles);assert.equal(f.view.scene.children.length,1);assert.equal(f.disposed,1);assert.equal(JSON.stringify(f.view.world.objects),before);f.record.batch.getMatrixAt(0,matrix);assert.equal(matrix.elements[0],1);
});
test('released depleted instances remain hidden and current hidden indices stay coherent',()=>{
 const f=fixture(),state=freshGame(),bound=bindInlandVisual(f.view,f.prepared);state.depleted[f.nodes[0].id]=state.time+150;bound.update(state);bound.afterSync();assert.equal(typeof bound.release,'function');bound.release();assert.equal(f.record.batch.instanceMatrix.array[0],0);assert.equal(f.record.batch.instanceMatrix.array[16],1);assert(f.record.hidden.has(0));assert(!f.record.hidden.has(1));
});
test('a duplicate inland install fails without disturbing its existing owner',()=>{
 const f=fixture(),first=bindInlandVisual(f.view,f.prepared),obstacles=f.view.cameraObstacles,count=f.view.scene.children.length;assert.throws(()=>bindInlandVisual(f.view,f.prepared),/already|bound/i);assert.equal(f.view.cameraObstacles,obstacles);assert.equal(f.view.scene.children.length,count);assert(footprintBoxes(f.nodes[0]));first.release();
});
test('invalid later placement fails before changing any original resource contacts',()=>{
 const f=fixture();f.prepared.data.placements[1].pose[0]+=1;assert.throws(()=>bindInlandVisual(f.view,f.prepared),/pose/i);assert.equal(footprintBoxes(f.nodes[0]),null);assert.equal(f.view.scene.children.length,1);assert.equal(f.view.cameraObstacles,f.obstacles);f.prepared.release();
});
