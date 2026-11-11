import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatObservation} from '../tools/combat_observation.js';
const frame=(hp=100,enemy=40)=>({time:1,player:{x:2,z:3,hp},enemies:[{id:'crab',hp:enemy}],camera:[1,2,3],projection:{x:0,y:0}});
test('capture preserves input and records both damage transitions without initial fake damage',()=>{
 const probe=createCombatObservation(3),initial=frame();probe.record(initial);initial.player.hp=0;
 probe.record(frame(93,17));const result=probe.snapshot();
 assert.equal(result.frames[0].player.hp,100);assert.deepEqual(result.frames[0].changes,[]);
 assert.deepEqual(result.frames[1].changes,[{kind:'player-hp',before:100,after:93},{kind:'enemy-hp',id:'crab',before:40,after:17}]);
 result.frames[1].player.hp=1;assert.equal(probe.snapshot().frames[1].player.hp,93);
});
test('bounded history reports dropped frames and retains transitions across eviction',()=>{
 const probe=createCombatObservation(2);probe.record(frame());probe.record(frame());probe.record(frame(93,0));
 const result=probe.snapshot();assert.equal(result.dropped,1);assert.equal(result.frames.length,2);assert.equal(result.frames[1].changes.length,2);
 assert.throws(()=>createCombatObservation(1));
});
