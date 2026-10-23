import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCreature} from '../src/creature.js';
import {WorldView} from '../src/scene.js';

for(const type of ['boar','crab'])test(`${type}: local coat/shell maps are bounded and shared until the last private rig is released`,()=>{
  const cache=new Map(),a=createCreature(type,cache),b=createCreature(type,cache);
  const textures=[a.userData.hide.map,a.userData.hide.normalMap,a.userData.hide.roughnessMap];
  assert.ok(textures.every(t=>t?.isDataTexture),'body cannot remain a flat untextured primitive');
  assert.notEqual(a.userData.hide,b.userData.hide);
  for(const [i,slot]of ['map','normalMap','roughnessMap'].entries()){
    assert.equal(a.userData.hide[slot],b.userData.hide[slot]);
    const t=textures[i];assert.ok(t.image.width<=256&&t.image.height<=256);
    assert.equal(t.wrapS,THREE.RepeatWrapping);assert.equal(t.wrapT,THREE.RepeatWrapping);
    assert.ok(t.image.data.every(Number.isFinite));
  }
  assert.equal(textures[0].colorSpace,THREE.SRGBColorSpace);
  let disposed=0;for(const t of textures)t.addEventListener('dispose',()=>disposed++);
  a.userData.hide.emissive.setRGB(.2,0,0);assert.equal(b.userData.hide.emissive.r,0);
  WorldView.prototype.disposeGroup(a);assert.equal(disposed,0,'a live neighbour still uses every map');
  WorldView.prototype.disposeGroup(b);assert.equal(disposed,3,'release all three textures exactly once');
});

test('boar has a connected shoulder-to-snout hide rather than two overlapping body primitives',()=>{
  const boar=createCreature('boar'),meshes=boar.userData.body.children.filter(o=>o.isMesh&&o.material===boar.userData.hide);
  let continuous=false;
  for(const mesh of meshes){
    const g=mesh.geometry,p=g.attributes.position,parents=Array.from({length:p.count},(_,i)=>i);
    const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
    for(let i=0;i<g.index.count;i+=3){const a=find(g.index.getX(i));parents[find(g.index.getX(i+1))]=a;parents[find(g.index.getX(i+2))]=a;}
    const extents=new Map();for(let i=0;i<p.count;i++){const k=find(i),e=extents.get(k)??[Infinity,-Infinity];e[0]=Math.min(e[0],p.getZ(i));e[1]=Math.max(e[1],p.getZ(i));extents.set(k,e);}
    continuous||=[...extents.values()].some(([min,max])=>min<-1.2&&max>1.85);
  }
  assert.ok(continuous,'one connected hide must span rump, shoulder and muzzle');
  WorldView.prototype.disposeGroup(boar);
});
