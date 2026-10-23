import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import * as world from '../src/world.js';
import {createSky,updateSky} from '../src/sky.js';
import {WorldView} from '../src/scene.js';

test('weather is deterministic over several days with bounded continuous transitions',()=>{
  assert.equal(typeof world.weatherAt,'function');
  for(let time=-1920;time<=3840;time+=3){
    const a=world.weatherAt(time),b=world.weatherAt(time+.25);
    assert.deepEqual(a,world.weatherAt(time+1920));
    assert.ok(a.cloudiness>=0&&a.cloudiness<=1);
    assert.ok(a.sunlight>=.2&&a.sunlight<=1&&a.skylight>=.8&&a.skylight<=1);
    assert.ok(a.fogNear>=80&&a.fogNear<a.fogFar&&a.fogFar<=470);
    assert.ok(Math.abs(a.cloudiness-b.cloudiness)<.001);
  }
  const clear=world.weatherAt(240),overcast=world.weatherAt(1200);
  assert.ok(clear.cloudiness<.05&&overcast.cloudiness>.95);
  assert.ok(overcast.sunlight<clear.sunlight*.4&&overcast.fogFar<clear.fogFar*.8);
  assert.ok(Object.values(world.weatherAt(Number.MAX_VALUE)).every(Number.isFinite));
});

test('sky cloud coverage and haze use the shared weather without replacing resources',()=>{
  assert.equal(typeof world.weatherAt,'function');
  const sky=createSky(),camera=new THREE.PerspectiveCamera(),fog=new THREE.Fog(0,120,470);
  const geometry=sky.geometry,material=sky.material,uniforms=material.uniforms;
  updateSky(sky,240,camera,fog,world.weatherAt(240));const clear=fog.color.clone();
  updateSky(sky,1200,camera,fog,world.weatherAt(1200));
  assert.ok(uniforms.cloudiness.value>.95&&uniforms.sunlight.value<.4);
  assert.ok(fog.color.g<clear.g*.85,'overcast horizon should lose daytime glare');
  assert.ok(fog.color.equals(uniforms.horizon.value));
  updateSky(sky,1440,camera,fog,world.weatherAt(1440));
  assert.ok(uniforms.cloud.value.g<.04,'overcast night clouds stay dark');
  assert.equal(sky.geometry,geometry);assert.equal(sky.material,material);assert.equal(material.uniforms,uniforms);
  geometry.dispose();material.dispose();
});

test('production atmosphere coordinates sunlight, land fog and water with stable resources',()=>{
  assert.equal(typeof WorldView.prototype.updateAtmosphere,'function');
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0,120,470);scene.background=new THREE.Color();
  const view={scene,camera:new THREE.PerspectiveCamera(),sky:createSky(),ambient:new THREE.AmbientLight(),sun:new THREE.DirectionalLight()};
  WorldView.prototype.createWater.call(view);
  const waterUniforms=view.waterUniforms,reflection=waterUniforms.skyColor.value;
  WorldView.prototype.updateAtmosphere.call(view,240);
  const clear={sun:view.sun.intensity,ambient:view.ambient.intensity,glint:waterUniforms.sunlight.value,light:waterUniforms.light.value,far:scene.fog.far};
  WorldView.prototype.updateAtmosphere.call(view,1200);
  assert.ok(view.sun.intensity<clear.sun*.4&&view.ambient.intensity<clear.ambient);
  assert.ok(view.ambient.intensity>clear.ambient*.8,'overcast should preserve foreground readability');
  assert.ok(waterUniforms.sunlight.value<clear.glint*.4&&waterUniforms.light.value<clear.light);
  assert.ok(scene.fog.far<clear.far);assert.deepEqual(waterUniforms.fogRange.value.toArray(),[scene.fog.near,scene.fog.far]);
  for(let i=0;i<200;i++)WorldView.prototype.updateAtmosphere.call(view,i*12);
  WorldView.prototype.updateAtmosphere.call(view,1440);
  assert.ok(view.ambient.intensity>.8&&view.ambient.intensity<clear.ambient*.5&&waterUniforms.light.value>.1,'midnight foreground stays lit while preserving a strong day/night difference');
  WorldView.prototype.updateAtmosphere.call(view,240);
  assert.equal(view.sun.intensity,clear.sun);assert.equal(waterUniforms.sunlight.value,clear.glint);
  assert.equal(view.waterUniforms,waterUniforms);assert.equal(reflection,scene.fog.color);
  view.water.geometry.dispose();view.water.material.dispose();waterUniforms.terrainMap.value.dispose();view.sky.geometry.dispose();view.sky.material.dispose();
});

test('night side light adds silhouette depth, fades by daylight and follows weather without a second shadow map',()=>{
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0,120,470);scene.background=new THREE.Color();
  const view={scene,camera:new THREE.PerspectiveCamera(),sky:createSky(),ambient:new THREE.AmbientLight(),sun:new THREE.DirectionalLight(),nightLight:new THREE.DirectionalLight(0x9aadd4,0)};
  WorldView.prototype.createWater.call(view);WorldView.prototype.updateAtmosphere.call(view,0);
  const night=view.nightLight.intensity;assert.ok(night>.5&&night<1);assert.equal(view.nightLight.castShadow,false);
  WorldView.prototype.updateAtmosphere.call(view,240);assert.equal(view.nightLight.intensity,0);
  const weather={...world.weatherAt(0),skylight:.5};WorldView.prototype.updateAtmosphere.call(view,0,weather);assert.ok(view.nightLight.intensity<night);
});
