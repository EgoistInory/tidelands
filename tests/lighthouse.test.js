import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createLighthouse} from '../src/lighthouse.js';

test('lighthouse details fit the existing camera envelope while the beam stays separate',()=>{
  const root=createLighthouse(),{lantern,beacon}=root.userData;root.updateMatrixWorld(true);
  assert.ok(lantern.isMesh&&lantern.material.emissive);assert.equal(lantern.parent,root);
  assert.equal(beacon.parent,root);assert.equal(beacon.visible,false);assert.equal(beacon.position.y,21.7);
  const box=new THREE.Box3();
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    let animated=false;for(let p=mesh.parent;p;p=p.parent)if(p===beacon)animated=true;
    assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
    if(mesh.geometry.attributes.normal)assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
    if(!animated)box.union(new THREE.Box3().setFromObject(mesh));
  });
  assert.ok(box.min.x>=-3.2&&box.max.x<=3.2&&box.min.z>=-3.2&&box.max.z<=3.2);
  assert.ok(box.min.y>=-.05&&box.max.y<=25.001);
  const light=beacon.children.find(m=>m.isPointLight),beam=beacon.children.find(m=>m.isMesh);
  assert.deepEqual([light.intensity,light.distance,light.decay],[65,55,1.5]);
  assert.equal(beam.position.x,45);assert.equal(beam.rotation.z,Math.PI/2);
  assert.equal(beam.material.opacity,.12);assert.equal(beam.material.depthWrite,false);
});

test('lighthouse optical emission is private and static architectural parts are batched',()=>{
  const a=createLighthouse(),b=createLighthouse();
  assert.notEqual(a.userData.lantern.material,b.userData.lantern.material);
  a.userData.lantern.material.emissive.set(0xffce72);a.userData.lantern.material.emissiveIntensity=2;
  assert.equal(b.userData.lantern.material.emissive.getHex(),0);
  const panes=a.children.find(m=>m.material?.transparent);assert.ok(panes&&panes.material.opacity<.4&&panes.material.depthWrite===false);
  assert.ok(a.children.filter(m=>m.isMesh).length<=9,'details are shared static surfaces rather than many world draw calls');
  let triangles=0;a.traverse(m=>{if(m.isMesh)triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
  assert.ok(triangles>1000&&triangles<10000,'bounded single landmark budget');
});
