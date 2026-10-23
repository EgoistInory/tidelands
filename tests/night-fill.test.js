import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createSky} from '../src/sky.js';
import {weatherAt,dayCycle} from '../src/world.js';

test('night fill keeps unlit surfaces readable across clear and overcast weather without changing daylight or key lights',()=>{
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0,120,470);scene.background=new THREE.Color();
  const view={scene,camera:new THREE.PerspectiveCamera(),sky:createSky(),ambient:new THREE.HemisphereLight(),sun:new THREE.DirectionalLight(),nightLight:new THREE.DirectionalLight()};
  WorldView.prototype.createWater.call(view);
  try{
    const identities=[view.ambient.color,view.ambient.groundColor,view.waterUniforms,view.sky.material];
    for(const time of [0,1440]){
      const weather=weatherAt(time);WorldView.prototype.updateAtmosphere.call(view,time,weather);
      assert.ok(view.ambient.intensity>=.8&&view.ambient.intensity<1,'night needs a visible fill floor even under cloud');
      assert.ok(Math.abs(view.sun.intensity-.04*2.6*weather.sunlight)<1e-12,'sun is unchanged');
      assert.ok(Math.abs(view.nightLight.intensity-.7*weather.skylight)<1e-12,'moon key is unchanged');
    }
    for(const time of [180,240,300]){
      WorldView.prototype.updateAtmosphere.call(view,time);
      const daylight=Math.max(.04,Math.min(1,Math.sin((time/480-.25)*Math.PI*2)*.85+.15));
      assert.equal(view.ambient.intensity,(.6+Math.sqrt((daylight-.04)/.96)*1.5)*weatherAt(time).skylight,'daytime is byte-for-byte the old energy calculation');
    }
    let previous=null,maxStep=0,oldPrevious=null,oldMaxStep=0;
    for(let time=0;time<=480;time+=.25){
      WorldView.prototype.updateAtmosphere.call(view,time);assert.ok(Number.isFinite(view.ambient.intensity));
      if(previous!==null)maxStep=Math.max(maxStep,Math.abs(view.ambient.intensity-previous));previous=view.ambient.intensity;
      const old=(.6+Math.sqrt((dayCycle(time).daylight-.04)/.96)*1.5)*weatherAt(time).skylight;
      if(oldPrevious!==null)oldMaxStep=Math.max(oldMaxStep,Math.abs(old-oldPrevious));oldPrevious=old;
    }
    assert.ok(maxStep<=oldMaxStep+1e-12,'fill adds no larger day/night step than the original curve');
    assert.deepEqual([view.ambient.color,view.ambient.groundColor,view.waterUniforms,view.sky.material],identities);
    assert.equal(view.nightLight.castShadow,false);
  }finally{view.water.geometry.dispose();view.water.material.dispose();view.waterUniforms.terrainMap.value.dispose();view.sky.geometry.dispose();view.sky.material.dispose();}
});
