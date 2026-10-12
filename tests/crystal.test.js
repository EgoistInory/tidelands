import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCrystalDeposit} from '../src/crystal.js';
import {mergeStaticParts} from '../src/merge-parts.js';

test('crystal cluster has grounded mineral prisms within the existing camera volume',()=>{
  const model=createCrystalDeposit();model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  assert.ok(bounds.min.y<=0&&bounds.min.y>-.3,'base floats or is buried');
  assert.ok(bounds.max.y>2&&bounds.max.y<=3.5,'camera height envelope changed');
  assert.ok(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.z),Math.abs(bounds.max.z))<=1.5);
  assert.equal(model.children.length,2,'cluster and rocky base must remain two instanced parts');
});
test('crystal facets have finite lit surfaces and local colour variation within a bounded mesh budget',()=>{
  const model=createCrystalDeposit();let triangles=0;
  for(const mesh of model.children){
    const geometry=mesh.geometry,p=geometry.attributes.position;
    triangles+=(geometry.index?.count??p.count)/3;
    for(const attr of Object.values(geometry.attributes))assert.ok([...attr.array].every(Number.isFinite));
    assert.ok(geometry.attributes.normal&&geometry.attributes.uv);
  }
  assert.ok(triangles>60&&triangles<500,'mineral detail has an unbounded geometry cost');
  const crystal=model.children.find(m=>m.material.vertexColors),colors=crystal?.geometry.attributes.color;
  assert.ok(colors&&new Set(colors.array).size>4,'facets have no colour/height variation');
  assert.equal(crystal.material.transparent,false,'opaque mineral must not introduce sorting/transmission passes');
});
test('crystal instancing input stays deterministic and survives static merging without losing colours',()=>{
  const a=createCrystalDeposit(),b=createCrystalDeposit();
  const crystal=a.children.find(m=>m.material.vertexColors);
  assert.deepEqual(crystal.geometry.attributes.position.array,b.children.find(m=>m.material.vertexColors).geometry.attributes.position.array);
  const before=crystal.geometry;mergeStaticParts(a);
  assert.ok(a.children.some(m=>m.geometry===before&&m.geometry.attributes.color));
  assert.equal(a.children.length,2);
  assert.notEqual(a.children[0].geometry,b.children[0].geometry);
});
