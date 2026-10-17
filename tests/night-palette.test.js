import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createSky} from '../src/sky.js';

test('night sky bounce loses daytime green cast while retaining daylight palette and lighting resources',()=>{
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0,120,470);scene.background=new THREE.Color();
  const view={scene,camera:new THREE.PerspectiveCamera(),sky:createSky(),ambient:new THREE.HemisphereLight(0xe2f1df,0x697346),sun:new THREE.DirectionalLight(),nightLight:new THREE.DirectionalLight()};
  WorldView.prototype.createWater.call(view);
  const skyColor=view.ambient.color,groundColor=view.ambient.groundColor;
  WorldView.prototype.updateAtmosphere.call(view,0);
  assert.ok(skyColor.b>skyColor.g&&groundColor.b>groundColor.g,'night bounce must be cool instead of daytime green');
  assert.ok(view.ambient.intensity>.5&&view.ambient.intensity<.7,'palette correction must retain the night intensity');
  WorldView.prototype.updateAtmosphere.call(view,240);
  assert.ok(skyColor.equals(new THREE.Color(0xe2f1df)));assert.ok(groundColor.equals(new THREE.Color(0x697346)));
  assert.equal(view.ambient.color,skyColor);assert.equal(view.ambient.groundColor,groundColor);
  let prior=groundColor.clone();
  for(let time=240;time<=480;time+=.25){WorldView.prototype.updateAtmosphere.call(view,time);assert.ok(Math.max(Math.abs(prior.r-groundColor.r),Math.abs(prior.g-groundColor.g),Math.abs(prior.b-groundColor.b))<.01);prior.copy(groundColor);}
  view.water.geometry.dispose();view.water.material.dispose();view.waterUniforms.terrainMap.value.dispose();view.sky.geometry.dispose();view.sky.material.dispose();
});
