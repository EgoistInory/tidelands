import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import * as meadow from '../src/meadow.js';
import {createWorld,terrain,LANDMARKS,SPAWN,ISLANDS,regionAt} from '../src/world.js';
import {WorldView} from '../src/scene.js';

test('fern fronds remain rooted, deterministic and finite with bounded leaf geometry',()=>{
  assert.equal(typeof meadow.createFernClump,'function');
  const a=meadow.createFernClump(),b=meadow.createFernClump(),p=new THREE.Vector3(),q=new THREE.Vector3(),r=new THREE.Vector3();
  const {position,normal,color}=a.geometry.attributes,index=a.geometry.index.array;
  assert.deepEqual(position.array,b.geometry.attributes.position.array);
  assert.ok(index.length/3<400&&index.length/3>100);
  assert.ok(position.array.every(Number.isFinite)&&color.array.every(c=>c>=0&&c<=1));
  for(let i=0;i<normal.count;i++)assert.ok(Math.abs(p.fromBufferAttribute(normal,i).length()-1)<1e-5);
  for(let i=0;i<index.length;i+=3){p.fromBufferAttribute(position,index[i]);q.fromBufferAttribute(position,index[i+1]);r.fromBufferAttribute(position,index[i+2]);assert.ok(q.sub(p).cross(r.sub(p)).length()>1e-7);}
  for(let i=0;i<position.count;i++){p.fromBufferAttribute(position,i);assert.ok(p.y>=0&&p.y<.8);q.copy(p).add(new THREE.Vector3(.109,0,0));assert.ok(a.geometry.boundingBox.containsPoint(q));}
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>\n#include <project_vertex>'};a.material.onBeforeCompile(shader);
  meadow.updateMeadow(360);assert.equal(shader.uniforms.meadowTime.value,360);
  assert.ok(shader.vertexShader.includes('clamp(position.y/.65')&&shader.vertexShader.includes('smoothstep(50.,80.'));
  assert.equal(a.material,b.material);a.geometry.dispose();b.geometry.dispose();
});

test('forest cover clusters beside trees without changing resources, routes or deterministic placement',()=>{
  assert.equal(typeof meadow.createForestCover,'function');
  const world=createWorld(),before=JSON.stringify(world),batches=meadow.createForestCover(world.objects),other=meadow.createForestCover(world.objects);
  assert.equal(JSON.stringify(world),before);assert.deepEqual(batches.map(b=>[...b.instanceMatrix.array]),other.map(b=>[...b.instanceMatrix.array]));
  const count=batches.reduce((n,b)=>n+b.count,0);assert.ok(count>1000&&count<6000);
  assert.equal(new Set(batches.map(b=>b.geometry)).size,1);assert.equal(new Set(batches.map(b=>b.material)).size,1);
  const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),trees=world.objects.filter(o=>o.type==='tree'),byRegion=new Map(),occupied=new Map();
  for(const batch of batches)for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);const {x,z}=point,y=terrain(x,z),key=regionAt(x,z);
    assert.ok(Math.abs(point.y-y+.04)<1e-4&&y>=3.499&&y<=28.001);
    assert.ok(Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5))<.601);
    assert.ok(trees.some(o=>Math.hypot(x-o.x,z-o.z)<12));
    assert.ok(LANDMARKS.every(o=>Math.hypot(x-o.x,z-o.z)>=(o.id==='cottage'?8.999:6.999)));
    assert.ok(Math.hypot(x-SPAWN.x,z-SPAWN.z)>=6.999);
    byRegion.set(key,(byRegion.get(key)??0)+1);
    const cx=Math.floor(x),cz=Math.floor(z);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const prior of occupied.get(`${cx+dx},${cz+dz}`)??[])assert.ok(Math.hypot(x-prior[0],z-prior[1])>.799);
    const cell=`${cx},${cz}`;if(!occupied.has(cell))occupied.set(cell,[]);occupied.get(cell).push([x,z]);
    assert.ok(batch.boundingBox.containsBox(batch.geometry.boundingBox.clone().applyMatrix4(matrix)));
  }
  assert.equal(byRegion.size,4);assert.ok(byRegion.get(ISLANDS[1].name)>byRegion.get(ISLANDS[3].name));
});

test('production scenery includes nearby ferns and recovers them after distance culling',()=>{
  const world=createWorld(),before=JSON.stringify(world),view={world,scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};
  WorldView.prototype.createScenery.call(view);
  const ferns=view.meadow.filter(b=>b.name==='meadow-fern');assert.ok(ferns.length>0);assert.equal(JSON.stringify(world),before);
  const batch=ferns[0],center=batch.boundingBox.getCenter(new THREE.Vector3());
  meadow.updateGroundCover(view.meadow,center);assert.equal(batch.visible,true);
  meadow.updateGroundCover(view.meadow,new THREE.Vector3(batch.boundingBox.max.x+81,0,center.z));assert.equal(batch.visible,false);
  meadow.updateGroundCover(view.meadow,center);assert.equal(batch.visible,true);
  batch.userData.detailEnabled=false;meadow.updateGroundCover(view.meadow,center);assert.equal(batch.visible,false);
  assert.ok(view.batches.every(({entries})=>entries.every(o=>world.objects.includes(o))));
});
