import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanopy,createBerryFoliage,barkSurface,updateFoliage} from '../src/foliage.js';

test('leaf canopy stays finite and its wind bounds fit the tree camera clearance',()=>{
  const a=createCanopy(),b=createCanopy();
  for(const name of ['position','normal','uv','color']){
    const data=a.geometry.attributes[name].array;
    assert.ok(data.every(Number.isFinite),name);
    assert.deepEqual(data,b.geometry.attributes[name].array);
  }
  const {min,max}=a.geometry.boundingBox;
  assert.ok(min.x>=-3.9&&max.x<=3.9&&min.z>=-3.9&&max.z<=3.9);
  assert.ok(min.y>3&&max.y<11);
  const positions=a.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    assert.ok(positions.getX(i)-min.x>=.219&&max.x-positions.getX(i)>=.219);
    assert.ok(positions.getZ(i)-min.z>=.219&&max.z-positions.getZ(i)>=.219);
  }
  for(const n of a.geometry.attributes.normal.array)assert.ok(Math.abs(n)<=1.001);
  a.geometry.dispose();b.geometry.dispose();
});

test('visible and shadow leaves use the same wind shader and advancing clock',()=>{
  const canopy=createCanopy(),visible={uniforms:{},vertexShader:'#include <begin_vertex>'},shadow={uniforms:{},vertexShader:'#include <begin_vertex>'};
  canopy.material.onBeforeCompile(visible);canopy.customDepthMaterial.onBeforeCompile(shadow);
  assert.equal(visible.vertexShader,shadow.vertexShader);
  assert.equal(visible.uniforms.leafWindTime,shadow.uniforms.leafWindTime);
  updateFoliage(120);assert.equal(visible.uniforms.leafWindTime.value,120);
  updateFoliage(121);assert.equal(shadow.uniforms.leafWindTime.value,121);
  assert.equal(canopy.material.map,canopy.customDepthMaterial.map);
  assert.equal(canopy.material.alphaTest,canopy.customDepthMaterial.alphaTest);
  canopy.geometry.dispose();
});

test('canopies share a bounded mipmapped cutout texture with opaque leaves and empty edges',()=>{
  const a=createCanopy(),b=createCanopy(),map=a.material.map;
  assert.equal(a.material,b.material);assert.equal(map,b.material.map);
  assert.equal(map.image.data.byteLength,128*128*4);
  assert.equal(map.generateMipmaps,true);
  const alpha=map.image.data.filter((_,i)=>i%4===3);
  assert.ok(alpha.some(v=>v===0));assert.ok(alpha.some(v=>v===255));
  assert.equal(map.image.data[3],0);
  assert.equal(map.image.data[(64*128+64)*4+3],255);
  assert.ok(a.material.alphaTest>0&&!a.material.transparent);
  assert.ok(a.castShadow&&a.receiveShadow);
  a.geometry.dispose();b.geometry.dispose();
});

test('berry foliage fits the resource footprint and reuses visible and shadow leaf resources',()=>{
  const bush=createBerryFoliage(),tree=createCanopy(),other=createBerryFoliage();
  for(const name of ['position','normal','uv','color']){
    assert.ok(bush.geometry.attributes[name].array.every(Number.isFinite));
    assert.deepEqual(bush.geometry.attributes[name].array,other.geometry.attributes[name].array);
  }
  const {min,max}=bush.geometry.boundingBox;
  assert.ok(min.x>-1.5&&max.x<1.5&&min.z>-1.5&&max.z<1.5&&min.y>0&&max.y<2.3);
  assert.equal(bush.material,tree.material);assert.equal(bush.customDepthMaterial,tree.customDepthMaterial);
  assert.ok(bush.geometry.attributes.position.count/3<600);
  bush.geometry.dispose();tree.geometry.dispose();other.geometry.dispose();
});

test('bark texture is shared, bounded, opaque and mipmapped',()=>{
  const bark=barkSurface();assert.equal(bark,barkSurface());assert.equal(bark.map,bark.bumpMap);
  assert.equal(bark.map.image.data.byteLength,128*256*4);assert.equal(bark.map.generateMipmaps,true);
  for(let i=3;i<bark.map.image.data.length;i+=4)assert.equal(bark.map.image.data[i],255);
  assert.ok(new Set(bark.map.image.data.filter((_,i)=>i%4===0)).size>25);
  assert.ok(bark.roughness>=.9);assert.equal(bark.flatShading,false);
});
