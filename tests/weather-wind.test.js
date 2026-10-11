import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {weatherAt} from '../src/world.js';
import {createCanopy,updateFoliage} from '../src/foliage.js';
import {createFiberClump,updateMeadow} from '../src/meadow.js';
import {WorldView} from '../src/scene.js';
import {createSky} from '../src/sky.js';
import {GameAudio} from '../src/audio.js';

test('weather wind is bounded, deterministic and continuous across cycle boundaries',()=>{
  assert.ok(weatherAt(240).windStrength<weatherAt(1200).windStrength);
  for(let t=-1920;t<3840;t+=3){const a=weatherAt(t),b=weatherAt(t+.25);assert.ok(a.windStrength>=.4&&a.windStrength<=1);assert.equal(a.windStrength,weatherAt(t+1920).windStrength);assert.ok(Math.abs(a.windStrength-b.windStrength)<.001);}
});

test('leaf and grass color and shadow share stable wind strength without changing time phase',()=>{
  for(const [make,update,key] of [[createCanopy,updateFoliage,'leaf'],[createFiberClump,updateMeadow,'meadow']]){
    const mesh=make(),color={uniforms:{},vertexShader:'#include <begin_vertex>'},depth={uniforms:{},vertexShader:'#include <begin_vertex>'};
    mesh.material.onBeforeCompile(color);mesh.customDepthMaterial.onBeforeCompile(depth);
    const name=key==='leaf'?'leafWindStrength':'meadowWindStrength',time=key==='leaf'?'leafWindTime':'meadowTime';
    assert.ok(color.uniforms[name]);assert.equal(color.uniforms[name],depth.uniforms[name]);assert.equal(color.vertexShader,depth.vertexShader);
    const uniform=color.uniforms[name];update(240,.4);assert.equal(uniform.value,.4);update(240,1);assert.equal(uniform.value,1);assert.equal(color.uniforms[time].value,240);
    update(240,2);assert.equal(uniform.value,1);update(240,-1);assert.equal(uniform.value,0);update(240,1);
    assert.equal(color.uniforms[name],uniform);mesh.geometry.dispose();
  }
});

test('production water and atmosphere share bounded wind and reuse their uniforms',()=>{
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0,120,470);scene.background=new THREE.Color();
  const view={scene,camera:new THREE.PerspectiveCamera(),sky:createSky(),ambient:new THREE.AmbientLight(),sun:new THREE.DirectionalLight()};
  WorldView.prototype.createWater.call(view);const uniforms=view.waterUniforms;
  WorldView.prototype.updateAtmosphere.call(view,240);assert.ok(uniforms.windStrength);assert.equal(uniforms.windStrength.value,weatherAt(240).windStrength);const clear=uniforms.windStrength.value;
  WorldView.prototype.updateAtmosphere.call(view,1200);assert.ok(uniforms.windStrength.value>clear);assert.equal(uniforms.windStrength.value,weatherAt(1200).windStrength);
  assert.equal(uniforms,view.water.material.uniforms);view.water.geometry.dispose();view.water.material.dispose();uniforms.terrainMap.value.dispose();view.sky.geometry.dispose();view.sky.material.dispose();
});

function context(){
  const param=()=>({value:0,setTargetAtTime(v,t,ramp){this.value=v;this.ramp=ramp;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){},start(){},stop(){}});
  return {state:'running',sampleRate:100,currentTime:1,destination:node(),createGain:node,createBufferSource:node,createOscillator:node,createBiquadFilter:node,createBuffer:(_,n,rate)=>{const samples=new Float32Array(n);return {duration:n/rate,getChannelData:()=>samples};},async resume(){},async close(){this.state='closed';}};
}
test('wind and surf audio targets respond to weather while pause and shared buffers remain intact',async()=>{
  const audio=new GameAudio({contextFactory:context});audio.setActive(true);await audio.unlock();const buffer=audio.noise;
  // These clocks align the old wind and surf oscillations, isolating the slower weather change.
  const t=240,period=40*Math.PI;
  audio.update({x:0,z:0},t,1);const clear={wind:audio.wind.gain.value,surf:audio.surf.gain.value};
  const cloudy=t+period*8;audio.update({x:0,z:0},cloudy,1);
  assert.ok(audio.wind.gain.value>clear.wind*2&&audio.surf.gain.value>clear.surf*2);
  assert.ok(audio.wind.gain.ramp>0&&audio.surf.gain.ramp>0);audio.setActive(false);const paused=audio.wind.gain.value;
  audio.update({x:0,z:0},t,1);assert.equal(audio.wind.gain.value,paused);assert.equal(audio.master.gain.value,0);
  audio.setActive(true);audio.update({x:0,z:0},t,1);assert.ok(Math.abs(audio.wind.gain.value-clear.wind)<1e-8);assert.equal(audio.noise,buffer);assert.equal(audio.sources.size,0);
  await audio.dispose();
});
