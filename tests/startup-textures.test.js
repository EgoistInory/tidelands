import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSurfaceTextures} from '../src/startup-textures.js';

test('startup waits for decoded surfaces then uploads once per frame with progress',async()=>{
  const one={},two={},three={},events=[];let finish;
  const loaded=new Promise(resolve=>finish=resolve),surface={loaded,textures:[one,two]},other={loaded:Promise.resolve(),textures:[two,three]};
  const work=prepareSurfaceTextures([surface,other],{initTexture:t=>events.push(t)}, {nextFrame:async()=>events.push('frame'),onProgress:(done,total)=>events.push([done,total])});
  await Promise.resolve();assert.deepEqual(events,[]);finish();await work;
  assert.deepEqual(events,[[0,3],'frame',one,[1,3],'frame',two,[2,3],'frame',three,[3,3]]);
});

test('fallback surfaces upload only decoded channels and settle with zero available',async()=>{
  const good={},seen=[];const options={nextFrame:async()=>{},onProgress:()=>{}};
  await prepareSurfaceTextures([{loaded:Promise.resolve(),textures:[good],state:{status:'fallback'}}],{initTexture:t=>seen.push(t)},options);
  await prepareSurfaceTextures([{loaded:Promise.resolve(),textures:[],state:{status:'fallback'}}],{initTexture:t=>seen.push(t)},options);
  assert.deepEqual(seen,[good]);
});

test('abort interrupts an unresolved load and a pending frame without uploading',async()=>{
  for(const duringFrame of [false,true]){
    const control=new AbortController(),seen=[];const forever=new Promise(()=>{});
    const work=prepareSurfaceTextures([{loaded:duringFrame?Promise.resolve():forever,textures:[{}]}],{initTexture:t=>seen.push(t)},{signal:control.signal,nextFrame:()=>forever});
    await Promise.resolve();control.abort();await assert.rejects(work,{name:'AbortError'});assert.deepEqual(seen,[]);
  }
});

test('abort between frames stops later uploads and upload errors propagate',async()=>{
  const control=new AbortController(),seen=[],a={},b={};
  await assert.rejects(prepareSurfaceTextures([{loaded:Promise.resolve(),textures:[a,b]}],{initTexture:t=>{seen.push(t);control.abort();}},{signal:control.signal,nextFrame:async()=>{}}),{name:'AbortError'});
  assert.deepEqual(seen,[a]);
  await assert.rejects(prepareSurfaceTextures([{loaded:Promise.resolve(),textures:[a]}],{initTexture:()=>{throw Error('GPU unavailable');}},{nextFrame:async()=>{}}),/GPU unavailable/);
});

test('native WebGL upload errors prevent reporting a texture as prepared',async()=>{
  const gl={NO_ERROR:0,getError:()=>0x502},progress=[];
  await assert.rejects(prepareSurfaceTextures([{loaded:Promise.resolve(),textures:[{}]}],{initTexture:()=>{},getContext:()=>gl},{nextFrame:async()=>{},onProgress:(n,total)=>progress.push([n,total])}),/WebGL 1282/);
  assert.deepEqual(progress,[[0,1]]);
});
