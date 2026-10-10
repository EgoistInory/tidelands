import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {mergeStaticParts} from '../src/merge-parts.js';

test('merging retains transformed vertices, normals, UVs, joints and material ownership',()=>{
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial(),joint=new THREE.Group();
  group.add(joint);const originals=[],expected={position:[],normal:[],uv:[]};let released=0,materialReleased=0;
  material.addEventListener('dispose',()=>materialReleased++);
  for(let i=0;i<2;i++){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,3),material);
    mesh.position.set(i*3,1,-2);mesh.rotation.set(.2,i*.7,.3);mesh.scale.set(2,.7,1.5);mesh.castShadow=true;group.add(mesh);originals.push(mesh);
    mesh.updateMatrix();const transformed=mesh.geometry.toNonIndexed().applyMatrix4(mesh.matrix);
    for(const name of Object.keys(expected))expected[name].push(...transformed.attributes[name].array);
    mesh.geometry.addEventListener('dispose',()=>released++);transformed.dispose();
  }
  mergeStaticParts(group);
  assert.equal(group.children.length,2);assert.equal(joint.parent,group);
  const merged=group.children.find(o=>o.isMesh);assert.equal(merged.material,material);assert.equal(merged.castShadow,true);
  const expanded=merged.geometry.toNonIndexed();
  for(const name of Object.keys(expected))assert.deepEqual([...expanded.attributes[name].array],expected[name]);
  assert.equal(merged.geometry.attributes.position.count,48);assert.equal(merged.geometry.index.count,72);expanded.dispose();
  assert.equal(released,2);assert.equal(materialReleased,0);
  assert.deepEqual(merged.position.toArray(),[0,0,0]);
});

test('different materials and shadow flags never merge',()=>{
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial();
  for(let i=0;i<3;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(),i===2?material.clone():material);mesh.castShadow=i===1;group.add(mesh);}
  const original=[...group.children];mergeStaticParts(group);assert.deepEqual(group.children,original);
});

test('indexed and non-indexed parts keep their triangle order after concatenation',()=>{
  const group=new THREE.Group(),mat=new THREE.MeshStandardMaterial(),expected=[];
  for(let i=0;i<2;i++){
    const g=new THREE.BoxGeometry();const geometry=i?g.toNonIndexed():g;
    const part=new THREE.Mesh(geometry,mat);part.position.x=i*10;part.updateMatrix();
    const copy=(geometry.index?geometry.toNonIndexed():geometry.clone()).applyMatrix4(part.matrix);
    expected.push(...copy.attributes.position.array);copy.dispose();group.add(part);
  }
  mergeStaticParts(group);const geometry=group.children[0].geometry;
  assert.equal(geometry.index.count,72);assert.equal(geometry.attributes.position.count,60);
  assert.deepEqual([...geometry.toNonIndexed().attributes.position.array],expected);
});
