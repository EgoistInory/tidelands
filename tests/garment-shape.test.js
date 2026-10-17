import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';

test('trousers and sleeves cover the existing knee/elbow seam at the resting pose',()=>{
  const root=createCharacter();animateCharacter(root,{x:0,z:0,yaw:0,time:1,attackAt:-100,selected:'hand'},1/60,()=>0);root.updateMatrixWorld(true);
  for(const [joints,offset,color] of [[root.userData.knees,.105,0x343e3b],[root.userData.elbows,.095,0xb86636]])for(const joint of joints){
    const center=joint.getWorldPosition(new THREE.Vector3());
    for(const dy of [-.012,0,.012]){
      const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(offset,dy,.5)),new THREE.Vector3(0,0,-1));
      const hit=ray.intersectObject(joint.parent,true).find(h=>h.object.material.color.getHex()===color);
      assert.ok(hit&&hit.distance<.65,`${joint===root.userData.knees[0]?'knee':'joint'} ${dy} requires cloth coverage away from centerline`);
    }
  }
});

test('tailored cloth surfaces are finite, closed after UV seam welding and retain a bounded mesh cost',()=>{
  const root=createCharacter(),names=['travel-coat','travel-pack','trouser-thigh','trouser-shin','tailored-sleeve'];let tested=0,triangles=0;
  root.traverse(mesh=>{if(!names.includes(mesh.name))return;tested++;
    const {position,normal,uv}=mesh.geometry.attributes,index=mesh.geometry.index;
    assert.ok(mesh.material.userData.textile&&uv&&normal);assert.ok([...position.array,...normal.array,...uv.array].every(Number.isFinite));
    const welded=Array.from({length:position.count},(_,i)=>[position.getX(i),position.getY(i),position.getZ(i)].map(n=>Math.round(n*1e6)).join(':')),edges=new Map();let volume=0;
    for(let i=0;i<index.count;i+=3){
      const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],[a,b,c]=ids.map(n=>new THREE.Vector3().fromBufferAttribute(position,n));
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-15);volume+=a.dot(b.clone().cross(c))/6;
      for(let j=0;j<3;j++){const key=[welded[ids[j]],welded[ids[(j+1)%3]]].sort().join('/');edges.set(key,(edges.get(key)??0)+1);}
    }
    assert.ok(volume>0);assert.ok([...edges.values()].every(n=>n===2));triangles+=index.count/3;
  });
  assert.equal(tested,10);assert.ok(triangles<5000);
});
