import test from 'node:test';import assert from 'node:assert/strict';
import {createAuthoredPoseClock} from '../src/authored-pose-clock.js';
const state=(extra={})=>({x:0,z:0,time:0,selected:'hand',attackAt:-100,gatherAt:-100,hurtAt:-100,...extra});
test('authored locomotion follows actual travel at 30/60/144fps, including blocked movement',()=>{
 for(const fps of [30,60,144])for(const [speed,clip,stride]of [[2.4,'Walk_Loop',1.2999999523162842],[7,'Jog_Fwd_Loop',5],[12,'Sprint_Loop',5.5]]){
  const clock=createAuthoredPoseClock(1.5);clock.update(state(),0);let result;
  for(let i=1;i<=fps;i++)result=clock.update(state({x:speed*i/fps,time:i/fps}),1/fps);
  assert.equal(result.baseClip,clip);assert.ok(Math.abs(result.cycles-speed/(stride*1.5))<1e-9);
  const stopped=clock.update(state({x:speed,time:2}),1/fps);assert.equal(stopped.baseClip,'Idle_Loop');assert.equal(stopped.cycles,result.cycles);
 }
});
test('pause, restored time and teleport discard catch-up distance and reset contact state',()=>{
 const clock=createAuthoredPoseClock();clock.update(state(),0);clock.update(state({x:1,time:1}),1);const paused=clock.update(state({x:20,time:1}),0);assert.equal(paused.cycles,0);assert.equal(paused.resetContacts,true);
 const after=clock.update(state({x:20.1,time:1.01}),.01);assert.ok(after.cycles<.1);
 const restored=clock.update(state({x:20.1,time:0}),1/60);assert.equal(restored.cycles,0);assert.equal(restored.resetContacts,true);
 assert.throws(()=>createAuthoredPoseClock(0),/scale/);
});
test('game action precedence, exact durations and gathered equipment remain authoritative',()=>{
 const clock=createAuthoredPoseClock();const input=state({time:10.21,attackAt:10,gatherAt:10,gatherKind:'tree',gatherTool:'axe',selected:'sword',hurtAt:10.1});const copy=structuredClone(input);
 let r=clock.update(input,1/60);assert.equal(r.action,'attack');assert.equal(r.equipped,'sword');assert.ok(Math.abs(r.actionProgress-.21/.45)<1e-9);assert.ok(r.recoil>0);assert.deepEqual(input,copy);
 r=clock.update(state({time:10.21,gatherAt:10,gatherKind:'tree',gatherTool:'axe',selected:'hand'}),1/60);assert.equal(r.action,'gather');assert.equal(r.equipped,'axe');assert.ok(Math.abs(r.actionProgress-.5)<1e-9);
 r=clock.update(state({time:10.21,gatherAt:10,gatherKind:'berry',selected:'sword'}),1/60);assert.equal(r.equipped,'hand');
 r=clock.update(state({time:10.42,gatherAt:10}),1/60);assert.equal(r.action,null);
 r=clock.update(state({time:10.45,attackAt:10,swimming:true}),1/60);assert.equal(r.action,null);assert.equal(r.baseClip,'Swim_Idle_Loop');
 r=clock.update(state({time:10.21,gatherAt:10,swimming:true}),1/60);assert.equal(r.action,null);
});
