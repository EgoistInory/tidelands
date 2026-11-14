import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';import {createSky} from '../src/sky.js';import {createSceneFinish} from '../src/scene-finish.js';
test('sea reflects the same atmospheric colours, weather and cloud origin without reallocating uniforms',()=>{
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0,120,470);scene.background=new THREE.Color();
 const view={scene,camera:new THREE.PerspectiveCamera(),sky:createSky(),ambient:new THREE.HemisphereLight(),sun:new THREE.DirectionalLight()};WorldView.prototype.createWater.call(view);
 const u=view.waterUniforms,zenith=u.skyZenith.value,cloud=u.skyCloud.value,origin=u.skyOrigin.value;
 try{for(const time of [240,1200,900]){view.camera.position.set(60,20,-40);WorldView.prototype.updateAtmosphere.call(view,time);const sky=view.sky.material.uniforms;
  assert.equal(u.skyZenith.value,zenith);assert.equal(u.skyCloud.value,cloud);assert.equal(u.skyOrigin.value,origin);
  assert(zenith.equals(sky.zenith.value)&&cloud.equals(sky.cloud.value)&&origin.equals(sky.origin.value));assert.equal(u.skyLight.value,sky.light.value);assert.equal(u.cloudiness.value,sky.cloudiness.value);
 }}finally{view.water.geometry.dispose();view.water.material.dispose();u.terrainMap.value.dispose();view.sky.geometry.dispose();view.sky.material.dispose();}
});
test('HDR finish cleanly retains forward rendering on devices without float render targets',()=>{
 assert.equal(createSceneFinish({extensions:{has:()=>false}}),null);
});
