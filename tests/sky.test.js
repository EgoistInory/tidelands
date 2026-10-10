import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {skyPalette,createSky,updateSky} from '../src/sky.js';
import {WorldView} from '../src/scene.js';

test('sky and fog remain periodic, bounded and continuous across dawn and midnight',()=>{
  for(let time=-480;time<=480;time+=.25){
    const a=skyPalette(time),b=skyPalette(time+.25),next=skyPalette(time+480);
    for(const key of ['horizon','zenith','cloud']){
      assert.ok(a[key].equals(next[key]));
      for(const value of a[key].toArray())assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
      assert.ok(Math.max(...a[key].toArray().map((v,i)=>Math.abs(v-b[key].toArray()[i])))<.045);
    }
  }
  const noon=skyPalette(240),night=skyPalette(0);
  assert.ok(noon.zenith.g>night.zenith.g*10);assert.ok(noon.horizon.g>noon.zenith.g);
  assert.ok(night.cloud.g<.035,'night clouds must not retain daytime white');
});

test('sky follows long-distance exploration without depth or shadow occlusion and reuses GPU resources',()=>{
  const sky=createSky(),camera=new THREE.PerspectiveCamera(),fog=new THREE.Fog(0,120,470);
  const geometry=sky.geometry,material=sky.material,uniforms=material.uniforms;
  camera.position.set(390,19,-360);updateSky(sky,120,camera,fog);
  assert.ok(sky.position.equals(camera.position));assert.deepEqual(uniforms.origin.value.toArray(),[390,-360]);
  assert.ok(fog.color.equals(uniforms.horizon.value));
  assert.equal(material.depthWrite,false);assert.equal(material.depthTest,false);assert.equal(material.side,THREE.BackSide);
  assert.equal(sky.castShadow,false);assert.equal(sky.receiveShadow,false);assert.equal(sky.frustumCulled,false);
  for(let i=0;i<100;i++){camera.position.x-=7;updateSky(sky,i,camera,fog);}
  assert.equal(sky.geometry,geometry);assert.equal(sky.material,material);assert.equal(material.uniforms,uniforms);
  assert.ok(sky.position.equals(camera.position));
  geometry.dispose();material.dispose();
});

test('water shares the changing horizon color instead of retaining daytime reflection at night',()=>{
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xb8d4d5,120,470);
  const view={scene};WorldView.prototype.createWater.call(view);
  const sky=createSky(),camera=new THREE.PerspectiveCamera();
  const reflection=view.waterUniforms.skyColor.value;
  updateSky(sky,240,camera,scene.fog);const noon=reflection.g;
  updateSky(sky,0,camera,scene.fog);
  assert.equal(reflection,scene.fog.color);assert.equal(reflection,view.water.material.uniforms.skyColor.value);
  assert.ok(reflection.g<noon*.03);assert.deepEqual(view.waterUniforms.fogRange.value.toArray(),[120,470]);
  view.water.geometry.dispose();view.water.material.dispose();view.waterUniforms.terrainMap.value.dispose();sky.geometry.dispose();sky.material.dispose();
});
