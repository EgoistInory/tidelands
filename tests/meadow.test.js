import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {createGrassClump,createWildflower,createFiberClump,createMeadow,updateMeadow,updateGroundCover} from '../src/meadow.js';
import {randomGenerator,terrain,LANDMARKS,regionAt} from '../src/world.js';

test('curved grass and petals have finite normals, nondegenerate faces and bounded sway',()=>{
  for(const create of [createGrassClump,createWildflower,createFiberClump]){
    const a=create(),b=create(),{position,normal,color}=a.geometry.attributes,indices=a.geometry.index.array;
    assert.deepEqual(position.array,b.geometry.attributes.position.array);
    assert.ok(position.array.every(Number.isFinite)&&color.array.every(c=>Number.isFinite(c)&&c>=0&&c<=1));
    for(let i=0;i<normal.count;i++)assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(normal,i).length()-1)<1e-5);
    const p=new THREE.Vector3(),q=new THREE.Vector3(),r=new THREE.Vector3();
    for(let i=0;i<indices.length;i+=3){p.fromBufferAttribute(position,indices[i]);q.fromBufferAttribute(position,indices[i+1]);r.fromBufferAttribute(position,indices[i+2]);assert.ok(q.sub(p).cross(r.sub(p)).length()>1e-7);}
    for(let i=0;i<position.count;i++){
      p.fromBufferAttribute(position,i);assert.ok(p.y>=0&&p.y<(create===createFiberClump?1.5:.8));
      // Local sway may rotate in any direction with an instance's yaw.
      for(let angle=0;angle<Math.PI*2;angle+=Math.PI/4){q.copy(p).add(new THREE.Vector3(Math.cos(angle)*.109,0,Math.sin(angle)*.109));assert.ok(a.geometry.boundingBox.containsPoint(q));assert.ok(a.geometry.boundingSphere.containsPoint(q));}
    }
    assert.equal(a.material,b.material);assert.equal(a.material.side,THREE.DoubleSide);
    a.geometry.dispose();b.geometry.dispose();
  }
});

test('region culling preserves all original grass transforms and random sequence',()=>{
  const random=randomGenerator(4321),batches=createMeadow(random),matrix=new THREE.Matrix4(),grass=[];
  assert.equal(batches.filter(b=>b.name==='meadow-flowers').reduce((n,b)=>n+b.count,0),1200);
  for(const batch of batches){
    assert.ok(batch.count>0&&batch.count<26000&&batch.boundingSphere&&batch.boundingBox);
    for(let i=0;i<batch.count;i++){
      batch.getMatrixAt(i,matrix);
      const bounds=batch.geometry.boundingBox.clone().applyMatrix4(matrix);
      assert.ok(batch.boundingBox.containsBox(bounds));
      const sphere=batch.geometry.boundingSphere.clone().applyMatrix4(matrix);
      assert.ok(sphere.center.distanceTo(batch.boundingSphere.center)+sphere.radius<=batch.boundingSphere.radius+1e-4);
      if(batch.name==='meadow-grass')grass.push([...matrix.elements]);
    }
  }
  assert.equal(grass.length,22595);grass.sort((a,b)=>a[12]-b[12]||a[14]-b[14]);
  assert.equal(createHash('sha256').update(JSON.stringify(grass)).digest('hex'),'edd3e9c7927a4a6a072e80bc9add5d20230288837ceac1d15aa468ee7766fad2');
  assert.equal(random(),.67249841010198);
  for(const name of ['meadow-grass','meadow-flowers'])assert.equal(new Set(batches.filter(b=>b.name===name).map(b=>b.geometry)).size,1);
});

test('grass and flowers share the game clock for rooted vertex sway',()=>{
  const grass=createGrassClump(),flower=createWildflower(),fiber=createFiberClump(),shader={uniforms:{},vertexShader:'#include <begin_vertex>'},depthShader={uniforms:{},vertexShader:'#include <begin_vertex>'};
  grass.material.onBeforeCompile(shader);updateMeadow(240);
  fiber.customDepthMaterial.onBeforeCompile(depthShader);assert.equal(shader.uniforms.meadowTime,depthShader.uniforms.meadowTime);
  assert.equal(shader.vertexShader,depthShader.vertexShader);assert.equal(fiber.material,grass.material);
  assert.equal(shader.uniforms.meadowTime.value,240);assert.equal(grass.material,flower.material);
  assert.ok(shader.vertexShader.includes('instanceMatrix*meadowWorld')&&shader.vertexShader.includes('clamp(position.y/.65'));
  updateMeadow(250);assert.equal(shader.uniforms.meadowTime.value,250);
  grass.geometry.dispose();flower.geometry.dispose();fiber.geometry.dispose();
});

test('dense patches stay on gentle land with shared geometry and per-patch tint',()=>{
  const batches=createMeadow().filter(b=>b.name==='meadow-cover'),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),color=new THREE.Color();
  assert.ok(batches.length>0);assert.equal(new Set(batches.map(b=>b.geometry)).size,1);assert.equal(new Set(batches.map(b=>b.material)).size,1);
  const count=batches.reduce((n,b)=>n+b.count,0);assert.ok(count>50000&&count<120000);
  for(const batch of batches)for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);const {x,z}=position,y=terrain(x,z);
    assert.ok(y>=3.49&&y<=30.01);assert.ok(Math.abs(position.y-(y-.04))<1e-4);
    assert.ok(Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5))<.551);
    assert.ok(LANDMARKS.every(o=>Math.hypot(x-o.x,z-o.z)>=(o.id==='cottage'?7.999:5.999)));
    batch.getColorAt(i,color);assert.ok([color.r,color.g,color.b].every(c=>c>.5&&c<=1));
  }
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <project_vertex>'};batches[0].material.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes('smoothstep(50.,80.')&&shader.vertexShader.includes('transformed.y*=coverFade'));
  const grassShader={uniforms:{},vertexShader:'#include <begin_vertex>'};createGrassClump().material.onBeforeCompile(grassShader);
  assert.equal(shader.uniforms.meadowTime,grassShader.uniforms.meadowTime);
});

test('near patch batches cull beyond the fade range and recover after the camera returns',()=>{
  const batches=createMeadow(),cover=batches.find(b=>b.name==='meadow-cover'),center=cover.boundingBox.getCenter(new THREE.Vector3());
  updateGroundCover(batches,center);assert.equal(cover.visible,true);
  updateGroundCover(batches,new THREE.Vector3(cover.boundingBox.max.x+81,center.y,center.z));assert.equal(cover.visible,false);
  updateGroundCover(batches,new THREE.Vector3(cover.boundingBox.max.x+79,center.y,center.z));assert.equal(cover.visible,true);
  cover.userData.detailEnabled=false;updateGroundCover(batches,center);assert.equal(cover.visible,false);
  cover.userData.detailEnabled=true;updateGroundCover(batches,center);assert.equal(cover.visible,true);
  assert.ok(batches.filter(b=>!['meadow-cover','meadow-shore'].includes(b.name)).every(b=>b.visible));
});

test('coastal tufts stay above waves on gentle sand across all islands and cull at distance',()=>{
  const batches=createMeadow(),shore=batches.filter(b=>b.name==='meadow-shore'),matrix=new THREE.Matrix4(),regions=new Set();
  const count=shore.reduce((n,b)=>n+b.count,0);assert.ok(count>500&&count<5000);
  assert.equal(new Set(shore.map(b=>b.geometry)).size,1);assert.equal(new Set(shore.map(b=>b.material)).size,1);
  for(const b of shore)for(let i=0;i<b.count;i++){
    b.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14],y=terrain(x,z);
    assert.ok(y>=.549&&y<=2.401);assert.ok(Math.abs(matrix.elements[13]-y+.04)<1e-4);
    assert.ok(Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5))<.451);
    assert.ok(LANDMARKS.every(o=>Math.hypot(x-o.x,z-o.z)>7.999));regions.add(regionAt(x,z));
  }
  assert.equal(regions.size,4);
  const b=shore[0],center=b.boundingBox.getCenter(new THREE.Vector3());updateGroundCover(batches,center);assert.equal(b.visible,true);
  updateGroundCover(batches,new THREE.Vector3(b.boundingBox.max.x+81,0,center.z));assert.equal(b.visible,false);
  b.userData.detailEnabled=false;updateGroundCover(batches,center);assert.equal(b.visible,false);
  b.userData.detailEnabled=true;updateGroundCover(batches,center);assert.equal(b.visible,true);
});
