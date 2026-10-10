import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindPointerControls} from '../src/pointer-controls.js';
class Surface extends EventTarget{
  capture=new Set();firstElementChild={style:{transform:''}};
  hasPointerCapture(id){return this.capture.has(id);}
  setPointerCapture(id){this.capture.add(id);}
  releasePointerCapture(id){this.capture.delete(id);this.send('lostpointercapture',id);}
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
  send(type,id,x=86,y=50){const e=new Event(type);Object.assign(e,{pointerId:id,clientX:x,clientY:y,button:0,deltaY:10});this.dispatchEvent(e);}
}
test('pause clears captured gestures; stale and secondary pointers cannot resume movement',()=>{
 const world=new Surface(),joy=new Surface(),stick={x:0,z:0};let enabled=true,turns=0;
 const reset=bindPointerControls(world,joy,{enabled:()=>enabled,stick,look:()=>turns++,zoom:()=>turns++});
 joy.send('pointerdown',1);assert.equal(stick.x,1);joy.send('pointerdown',2,14);joy.send('pointerup',2);assert.equal(stick.x,1);
 world.send('pointerdown',3);world.send('pointermove',3,90);assert.equal(turns,1);
 enabled=false;reset();assert.deepEqual(stick,{x:0,z:0});assert.equal(joy.firstElementChild.style.transform,'');assert.equal(world.capture.size+joy.capture.size,0);
 enabled=true;joy.send('pointermove',1);world.send('pointermove',3,95);assert.equal(turns,1);assert.equal(stick.x,0);
 joy.send('pointerdown',4);joy.send('pointercancel',4);assert.equal(stick.x,0);
 enabled=false;world.send('wheel',0);assert.equal(turns,1);
});
