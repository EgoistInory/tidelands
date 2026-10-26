import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createWorld,terrain,LANDMARKS,SPAWN,ISLANDS} from '../src/world.js';
import {landscapeSample} from '../src/landscape.js';
import {woodlandPlacements,createWoodlandDressing} from '../src/woodland.js';

function models(){return ['fern','moss'].map((kind)=>{const scene=new THREE.Group();for(let i=0;i<(kind==='fern'?4:6);i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,.4,1),new THREE.MeshStandardMaterial({alphaTest:kind==='fern'?.5:0}));mesh.position.y=.2;scene.add(mesh);}return {scene};});}
test('woodland groups enrich forest interiors while keeping shallow warm coasts and object identities',()=>{
  const world=createWorld(),before=JSON.stringify(world),rows=woodlandPlacements(world.objects);
  assert.ok(rows.length>300&&rows.length<3000,'bounded regional dressing must actually be present');
  assert.equal(JSON.stringify(world),before);assert.deepEqual(rows,woodlandPlacements(world.objects));
  const forest=rows.filter(p=>landscapeSample(p.x,p.z).biome===1),shoal=rows.filter(p=>landscapeSample(p.x,p.z).biome===3);
  assert.ok(forest.length>rows.length*.5);assert.equal(shoal.length,0);
  for(const p of rows){assert.ok(terrain(p.x,p.z)>4);assert.ok(LANDMARKS.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>9));assert.ok(Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)>10);}
});
test('landmark approach corridors remain open to low dressing',()=>{
  const rows=woodlandPlacements(createWorld().objects);assert.ok(rows.length>300);
  for(const landmark of LANDMARKS){const island=ISLANDS[landscapeSample(landmark.x,landmark.z).biome],dx=island.x-landmark.x,dz=island.z-landmark.z,length=dx*dx+dz*dz;
    for(const p of rows){const t=Math.max(0,Math.min(1,((p.x-landmark.x)*dx+(p.z-landmark.z)*dz)/length));assert.ok(Math.hypot(p.x-landmark.x-t*dx,p.z-landmark.z-t*dz)>3.5);}
  }
});
test('small decorative stones cannot become visually solid invisible body blockers',()=>{
  const rows=woodlandPlacements(createWorld().objects);assert.ok(rows.some(p=>p.kind==='moss'));
  for(const p of rows.filter(p=>p.kind==='moss'))assert.ok(p.height<=.17&&p.height>0);
  const dressing=createWoodlandDressing(models(),[],[{kind:'moss',variant:0,x:-80,z:118,height:.15,rotation:0}]);
  assert.ok(dressing);const mesh=dressing.root.children[0],matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);const box=mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
  assert.ok(box.max.y-terrain(-80,118)<.19);dressing.release();
});
test('building a camp clears dressing and removing it restores original transforms without changing placement',()=>{
  const rows=[{kind:'fern',variant:0,x:-80,z:118,height:.6,rotation:0}],before=JSON.stringify(rows),dressing=createWoodlandDressing(models(),[],rows);assert.ok(dressing);
  const state={player:{x:-80,z:118},time:20,buildings:[]};dressing.update(state,1);const mesh=dressing.root.children[0],m=new THREE.Matrix4();mesh.getMatrixAt(0,m);assert.ok(m.determinant()>0);
  state.buildings.push({id:'fire',type:'campfire',x:-80,z:118});dressing.update(state,1);mesh.getMatrixAt(0,m);assert.equal(m.determinant(),0);
  state.buildings=[];dressing.update(state,1);mesh.getMatrixAt(0,m);assert.ok(m.determinant()>0);assert.equal(JSON.stringify(rows),before);dressing.release();
});
test('visible leaves and shadow depth use the same clock while release is idempotent',()=>{
  const dressing=createWoodlandDressing(models(),[],[{kind:'fern',variant:0,x:-80,z:118,height:.6,rotation:0}]);assert.ok(dressing);const mesh=dressing.root.children[0];
  const shader=()=>({uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <alphatest_fragment>'}),a=shader(),b=shader();mesh.material.onBeforeCompile(a);mesh.customDepthMaterial.onBeforeCompile(b);
  assert.equal(a.uniforms.woodlandTime,b.uniforms.woodlandTime);dressing.update({player:{x:-80,z:118},time:42,buildings:[]},.8);assert.equal(a.uniforms.woodlandTime.value,42);
  assert.ok(a.vertexShader.includes('woodlandWorld')&&b.vertexShader.includes('woodlandWorld'));assert.ok(a.fragmentShader.includes('discard')&&b.fragmentShader.includes('discard'));
  let released=0;mesh.geometry.addEventListener('dispose',()=>released++);dressing.release();dressing.release();assert.equal(released,1);assert.equal(dressing.root.children.length,0);
});
