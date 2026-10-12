import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';

test('continuous head surface is closed, outward and finite without degenerate triangles',()=>{
  const root=createCharacter(),head=root.getObjectByName('traveler-head-surface');
  assert.ok(head,'continuous head surface replaces the placeholder');
  const {position,normal}=head.geometry.attributes,index=head.geometry.index;
  assert.ok([...position.array,...normal.array].every(Number.isFinite));
  const edges=new Map();let volume=0;
  for(let i=0;i<index.count;i+=3){
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    const [a,b,c]=ids.map(n=>new THREE.Vector3().fromBufferAttribute(position,n));
    assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-15,'nonzero triangle area');
    volume+=a.dot(b.clone().cross(c))/6;
    for(let e=0;e<3;e++){const key=[ids[e],ids[(e+1)%3]].sort((x,y)=>x-y).join(':');edges.set(key,(edges.get(key)??0)+1);}
  }
  assert.ok(volume>0,'outward winding');assert.ok([...edges.values()].every(n=>n===2),'closed manifold');
  head.geometry.computeBoundingBox();const size=head.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(size.y>.45&&size.y<.54);assert.ok(size.x>.30&&size.x<.40);
  assert.equal(head.material.map,null);assert.equal(head.material.transparent,false);
});

test('face features and hair follow the head during complete production gestures',()=>{
  const root=createCharacter();
  for(const name of ['traveler-head','traveler-hair','eye-left','eye-right','brow-left','brow-right','mouth-line'])assert.ok(root.getObjectByName(name),name);
  for(const gesture of ['attack','gather'])for(let frame=0;frame<=60;frame++){
    const time=10+frame/60;
    animateCharacter(root,{x:0,z:0,yaw:0,time,attackAt:gesture==='attack'?10:-100,gatherAt:gesture==='gather'?10:-100,selected:'sword'},1/60,()=>0);
    root.updateMatrixWorld(true);
    root.getObjectByName('traveler-head').traverse(mesh=>{if(mesh.isMesh){assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));assert.equal(mesh.material.map,null);}});
  }
  assert.equal(root.getObjectByName('traveler-head').parent,root.userData.body);
  assert.equal(root.userData.sword.parent.parent,root.userData.elbows[1]);
});

test('hair covers the upper cranium rather than exposing a skin cap at the crown',()=>{
  const root=createCharacter();root.updateMatrixWorld(true);const head=root.getObjectByName('traveler-head'),center=head.getWorldPosition(new THREE.Vector3());
  for(const [x,z] of [[0,0],[.014,.015],[-.014,.015],[.03,-.01],[-.03,-.01]]){
    const ray=new THREE.Raycaster(new THREE.Vector3(center.x+x,center.y+.5,center.z+z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(head,true)[0];assert.equal(hit?.object.name,'traveler-hair',`crown ${x}/${z}`);
  }
});
