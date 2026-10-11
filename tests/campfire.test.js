import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingModel,WorldView} from '../src/scene.js';
import {updateCampfire} from '../src/campfire.js';

test('fire is a bounded transparent plume with no texture or shadow allocation',()=>{
  const camp=buildingModel('campfire'),flame=camp.userData.flame;
  assert.ok(flame?.isMesh);assert.equal(flame.material.isShaderMaterial,true);
  assert.equal(flame.material.transparent,true);assert.equal(flame.material.depthWrite,false);
  assert.equal(flame.castShadow,false);assert.equal(flame.material.uniforms.map,undefined);
  flame.geometry.computeBoundingBox();const box=flame.geometry.boundingBox;
  assert.ok(box.min.y>=.2&&box.max.y<=2.2);assert.ok(flame.geometry.index.count<=18);
  WorldView.prototype.disposeGroup(camp);
});

test('campfire time freezes with world time and has independent positions without rebuilding resources',()=>{
  const a=buildingModel('campfire'),b=buildingModel('campfire');b.position.set(18,0,-4);
  const geo=a.userData.flame.geometry,mat=a.userData.flame.material;
  updateCampfire(a,10);updateCampfire(b,10);const t=mat.uniforms.time.value;
  assert.notEqual(t,b.userData.flame.material.uniforms.time.value);
  for(let i=0;i<600;i++)updateCampfire(a,10);
  assert.equal(mat.uniforms.time.value,t);updateCampfire(a,11);assert.notEqual(mat.uniforms.time.value,t);
  updateCampfire(a,1e9);assert.ok(Number.isFinite(mat.uniforms.time.value)&&Math.abs(mat.uniforms.time.value)<4160);
  assert.equal(a.userData.flame.geometry,geo);assert.equal(a.userData.flame.material,mat);
  let released=0;mat.addEventListener('dispose',()=>released++);
  WorldView.prototype.disposeGroup(a);assert.equal(released,1);assert.notEqual(mat,b.userData.flame.material);
  WorldView.prototype.disposeGroup(b);
});

test('negative camp positions do not wrap the flame phase near the start of a journey',()=>{
  const camp=buildingModel('campfire');camp.position.set(-56,0,56);
  updateCampfire(camp,7.83);const before=camp.userData.flame.material.uniforms.time.value;
  updateCampfire(camp,7.85);assert.ok(Math.abs(camp.userData.flame.material.uniforms.time.value-before-.02)<1e-6);
  WorldView.prototype.disposeGroup(camp);
});
