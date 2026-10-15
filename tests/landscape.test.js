import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {ISLANDS,terrain,createWorld,LANDMARKS} from '../src/world.js';
import {landscapeSample,createShoreStones} from '../src/landscape.js';

test('four island surfaces distinguish warm dunes, woodland litter and exposed upland rock',()=>{
  const samples=ISLANDS.map(o=>landscapeSample(o.x,o.z));
  assert.deepEqual(samples.map(s=>s.biome),[0,1,2,3]);
  assert.ok(samples[2].rock>.6);assert.ok(samples[0].rock<.25&&samples[3].rock<.25);
  assert.equal(new Set(samples.map(s=>s.color.getHex())).size,4);
  for(let x=-280;x<280;x+=13)for(let z=-320;z<280;z+=17){
    const s=landscapeSample(x,z);assert.ok([s.rock,s.litter].every(n=>Number.isFinite(n)&&n>=0&&n<=1));
    assert.ok(s.color.toArray().every(n=>Number.isFinite(n)&&n>=0&&n<=1));
    if(terrain(x,z)<.4)assert.equal(s.rock+s.litter,0);
  }
});

test('shore stones are deterministic shallow dressing and preserve resources, enemies and routes',()=>{
  const world=createWorld(),before=JSON.stringify(world),a=createShoreStones(),b=createShoreStones();
  assert.equal(JSON.stringify(world),before);assert.ok(a.length>0&&a.length<120);
  assert.deepEqual(a.map(m=>[...m.instanceMatrix.array]),b.map(m=>[...m.instanceMatrix.array]));
  assert.equal(new Set(a.map(m=>m.geometry)).size,1);assert.equal(new Set(a.map(m=>m.material)).size,1);
  const matrix=new THREE.Matrix4(),regions=new Set();let count=0;
  for(const batch of a)for(let i=0;i<batch.count;i++){
    batch.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14],y=terrain(x,z),s=landscapeSample(x,z);
    assert.ok(y>=.45&&y<4.6);assert.ok(Math.abs(matrix.elements[13]-y)<.02);
    assert.ok(LANDMARKS.every(o=>Math.hypot(x-o.x,z-o.z)>10));
    const bounds=batch.geometry.boundingBox.clone().applyMatrix4(matrix);
    assert.ok(bounds.max.y-y<.19,'walk-over detail must not become an invisible solid boulder');
    assert.ok(batch.boundingBox.containsBox(bounds));regions.add(s.biome);count++;
  }
  assert.equal(regions.size,4);assert.ok(count>1500&&count<6500);
});

test('regional tree presentation varies crowns without widening resource contact footprints',async()=>{
  const {islandTreeAppearance}=await import('../src/landscape.js');
  assert.equal(typeof islandTreeAppearance,'function');
  const forms=ISLANDS.map(o=>islandTreeAppearance({x:o.x,z:o.z,scale:1}));
  assert.ok(forms[1].height>forms[0].height&&forms[2].height<forms[0].height);
  assert.equal(new Set(forms.map(f=>f.tint.getHex())).size,4);
  for(const [i,o]of ISLANDS.entries()){const f=islandTreeAppearance({...o,scale:1});assert.deepEqual(f,forms[i]);assert.ok(f.height>.65&&f.height<1.35);}
});
