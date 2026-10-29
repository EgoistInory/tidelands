import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createBerryBush,createDetailedCrystal} from './resource-detail-candidate.js';
import {mergeStaticParts} from '../src/merge-parts.js';

for(const [name,make,parts,budget,height] of [['berry',createBerryBush,3,7000,2.3],['crystal',createDetailedCrystal,2,1600,3.5]]){
  test(`${name} detail fits unchanged logical envelope with finite deterministic bounded instancing input`,()=>{
    const a=make(),b=make();a.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(a);
    assert.ok(box.min.y>=-.3&&box.max.y<=height);assert.ok(Math.max(Math.abs(box.min.x),Math.abs(box.max.x),Math.abs(box.min.z),Math.abs(box.max.z))<=1.5);
    let triangles=0;for(let i=0;i<a.children.length;i++){const mesh=a.children[i];for(const [key,value]of Object.entries(mesh.geometry.attributes)){assert.ok(value.array.every(Number.isFinite),key);assert.deepEqual(value.array,b.children[i].geometry.attributes[key].array);}triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;assert.equal(mesh.material.transparent,false);assert.equal(mesh.material,b.children[i].material);}
    assert.ok(triangles<budget,`${triangles} triangles`);mergeStaticParts(a);assert.equal(a.children.length,parts);
  });
}
test('berries are physically attached by their upper surface and preserve a bounded root footprint',()=>{
  const bush=createBerryBush();assert.equal(bush.userData.attachments.length,21);
  for(const a of bush.userData.attachments){assert.ok(Math.hypot(a.stemEnd[0]-a.center[0],a.stemEnd[1]-a.center[1],a.stemEnd[2]-a.center[2])<=a.radius*1.12);}
  assert.equal(bush.children.find(p=>p.name==='curved-veined-leaves').material.alphaTest,0,'curved geometry does not need cutout or sorting');
});
test('mineral caps face outwards at the top and bottom of the main prism',()=>{
  const g=createDetailedCrystal().children[0].geometry,p=g.attributes.position,n=g.attributes.normal;let up=0,down=0;
  for(let i=0;i<p.count;i+=3){if(Math.abs(p.getY(i)-3.05)<1e-5&&Math.abs(p.getY(i+1)-3.05)<1e-5&&Math.abs(p.getY(i+2)-3.05)<1e-5){assert.ok(n.getY(i)>.99);up++;}if(Math.abs(p.getY(i)-.05)<1e-5&&Math.abs(p.getY(i+1)-.05)<1e-5&&Math.abs(p.getY(i+2)-.05)<1e-5){assert.ok(n.getY(i)<-.99);down++;}}
  assert.equal(up,12);assert.ok(down>=12);
});
