import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorldView} from '../src/scene.js';

test('resizing keeps high-DPI drawing within a1080p pixel budget and restores small-canvas detail',t=>{
  const before=Object.getOwnPropertyDescriptor(globalThis,'devicePixelRatio');
  Object.defineProperty(globalThis,'devicePixelRatio',{value:2,writable:true,configurable:true});
  t.after(()=>{if(before)Object.defineProperty(globalThis,'devicePixelRatio',before);else delete globalThis.devicePixelRatio;});
  let ratio=1.5,width=0,height=0,projections=0;
  const view={canvas:{clientWidth:1920,clientHeight:1080},renderer:{setPixelRatio(value){ratio=value;},setSize(w,h){width=Math.floor(w*ratio);height=Math.floor(h*ratio);}},camera:{aspect:0,updateProjectionMatrix(){projections++;}}};
  WorldView.prototype.resize.call(view);
  assert.ok(width*height<=1920*1080,`high-DPI output allocates${width}x${height}pixels`);
  assert.equal(width,1920);assert.equal(height,1080);assert.equal(view.camera.aspect,1920/1080);
  Object.assign(view.canvas,{clientWidth:390,clientHeight:844});WorldView.prototype.resize.call(view);
  assert.equal(ratio,1.5,'mobile detail retains the established1.5DPR ceiling');
  assert.equal(width,585);assert.equal(height,1266);assert.equal(projections,2);
  globalThis.devicePixelRatio=1;WorldView.prototype.resize.call(view);
  assert.equal(ratio,1,'normal-DPI clients are not supersampled');
});
