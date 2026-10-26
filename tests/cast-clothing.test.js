import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {loadAuthorFixture} from './helpers/author-fixture.js';
import {dressAuthoredAvatar} from '../src/authored-wardrobe.js';
import {createAuthoredCharacter,animateAuthoredCharacter} from '../src/authored-character.js';

const roles=[['traveler','male'],['keeper','male'],['botanist','female'],['explorer','male']];
test('bending the opposite leg cannot pull a trouser surface across the crotch',()=>{
  const {body:avatar}=loadAuthorFixture();const outfit=dressAuthoredAvatar(avatar),mesh=outfit.getObjectByName('relaxed-trouser-l');assert.ok(mesh);
  avatar.updateMatrixWorld(true);const before=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()));
  avatar.getObjectByName('thigh_r').rotation.x+=.7;avatar.updateMatrixWorld(true);
  const displacement=Math.max(...before.map((p,i)=>p.distanceTo(mesh.getVertexPosition(i,new THREE.Vector3()))));
  assert.ok(displacement<1e-6,`opposite leg dragged left trouser ${displacement}m`);
});
test('all four real roles have continuous roomy sleeve/trouser surfaces without altering the author body',()=>{
  for(const [role,sex] of roles){
    const {body:avatar}=loadAuthorFixture(sex);let source;avatar.traverse(o=>{if(o.isSkinnedMesh)source=o;});
    const positions=Array.from(source.geometry.attributes.position.array),outfit=dressAuthoredAvatar(avatar,role);let triangles=0;
    for(const name of ['relaxed-sleeve-l','relaxed-sleeve-r','relaxed-trouser-l','relaxed-trouser-r']){
      const mesh=outfit.getObjectByName(name);assert.ok(mesh?.isSkinnedMesh,`${role} needs an actual cloth surface: ${name}`);
      const g=mesh.geometry,w=g.attributes.skinWeight,j=g.attributes.skinIndex;g.computeBoundingBox();
      assert.ok(g.boundingBox.getSize(new THREE.Vector3()).length()>.3);
      for(let i=0;i<w.count;i++){let sum=0;for(let k=0;k<4;k++){sum+=w.array[i*4+k];assert.ok(j.array[i*4+k]<mesh.skeleton.bones.length);}assert.ok(Math.abs(sum-1)<1e-6);}
      assert.ok(g.attributes.uv&&mesh.material.map);triangles+=g.index.count/3;
    }
    assert.ok(triangles<2500);assert.deepEqual(Array.from(source.geometry.attributes.position.array),positions);
  }
});
test('actual added cloth stays attached and finite through four-role whole-body action paths',()=>{
  for(const [role,sex]of roles){
    const {body,library}=loadAuthorFixture(sex),actor=createAuthoredCharacter(body,library,role),s={x:0,z:0,yaw:0,time:10,selected:'axe',attackAt:-100,gatherAt:-100,hurtAt:-100};
    const meshes=[];actor.traverse(o=>{if(o.name.startsWith('relaxed-'))meshes.push(o);});assert.equal(meshes.length,4);
    const lengths=actor.userData.legs.map(l=>l.knee.position.length());
    for(let frame=0;frame<150;frame++){
      s.time=10+frame/60;if(frame<60){s.yaw=frame/60;s.x+=Math.sin(s.yaw)*7/60;s.z+=Math.cos(s.yaw)*7/60;}if(frame===60)s.attackAt=s.time;if(frame===95){s.gatherAt=s.time;s.attackAt=-100;s.gatherKind='berry';s.gatherTarget={x:s.x+.5,y:.15,z:s.z+.5};}if(frame===130)s.hurtAt=s.time;
      animateAuthoredCharacter(actor,s,1/60,(x,z)=>.03*x+.04*z);actor.updateMatrixWorld(true);
      if(frame%10===0)for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i+=7){const p=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);assert.ok(p.toArray().every(Number.isFinite));assert.ok(Math.hypot(p.x-s.x,p.z-s.z)<2.5,'cloth must follow the real body rather than its bind pose');}
    }
    actor.userData.legs.forEach((l,i)=>assert.ok(Math.abs(l.knee.position.length()-lengths[i])<1e-6,'Float32 animation tracks must preserve source bone lengths within a micrometre'));
  }
});
