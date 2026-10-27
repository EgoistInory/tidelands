import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCoastalFarBatches} from './coastal-far-batches.js';
function fixture(){
  const geometry=new THREE.PlaneGeometry(2,4),materials=Array.from({length:4},()=>new THREE.MeshBasicMaterial()),model={farGeometry:geometry,farMaterials:materials};
  const rows=Array.from({length:7},(_,i)=>{const root=new THREE.Group(),far=new THREE.Mesh(geometry,materials[i%4]);root.position.set(i*3,2,5);root.rotation.y=.3;root.scale.setScalar(1.5);far.position.set(.7,0,-.2);far.rotation.y=(i%4)*Math.PI/2;root.add(far);root.updateMatrixWorld(true);return {model,root,far,level:'far',farFrame:i%4};});
  return {rows,geometry,materials};
}
test('far instances share at most four view batches and preserve exact world transforms',()=>{
  const {rows}=fixture(),scene=new THREE.Scene(),set=createCoastalFarBatches(THREE,scene,rows);set.update();
  const live=set.batches.filter(b=>b.count);assert.equal(live.length,4);assert.equal(live.reduce((s,b)=>s+b.count,0),7);
  for(const batch of live){const expected=rows.filter(r=>r.far.material===batch.material);assert.equal(batch.count,expected.length);expected.forEach((row,i)=>{const m=new THREE.Matrix4();batch.getMatrixAt(i,m);assert.deepEqual(m.elements,Array.from(new Float32Array(row.far.matrixWorld.elements)));});assert(batch.boundingSphere.radius>0);}
});
test('depletion or LOD changes compact instances without stale slots and can restore them',()=>{
  const {rows}=fixture(),set=createCoastalFarBatches(THREE,new THREE.Scene(),rows);set.update();rows[0].level='hidden';rows[1].level='near';set.update();assert.equal(set.batches.reduce((s,b)=>s+b.count,0),5);
  rows.forEach(r=>r.level='hidden');set.update();assert(set.batches.every(b=>b.count===0&&!b.visible));rows[0].level='far';set.update();assert.equal(set.batches.reduce((s,b)=>s+b.count,0),1);
});
test('release removes owned batches while shared geometry and material remain live',()=>{
  const {rows,geometry,materials}=fixture(),scene=new THREE.Scene();let sharedDisposals=0;geometry.addEventListener('dispose',()=>sharedDisposals++);materials.forEach(m=>m.addEventListener('dispose',()=>sharedDisposals++));
  const set=createCoastalFarBatches(THREE,scene,rows);assert.equal(scene.children.length,4);set.release();assert.equal(scene.children.length,0);assert.equal(sharedDisposals,0);set.release();
});
