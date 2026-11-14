import test from 'node:test';import assert from 'node:assert/strict';
import {applyDynamicContactCandidate} from '../tools/dynamic_contact_candidate.mjs';
import {actorBlocksMove3D} from '../tools/actor_contact_3d_candidate.js';
const actor={type:'crab',x:0,z:0},flat=()=>0;
test('adapter changes only two dynamic contacts and refuses stale source',()=>{
 const src='actorBlocksMove(from,to,state.player,radius); o!==mover&&o.hp>0&&actorBlocksMove(from,to,o,radius); actorBlocksMove(from,to,o,radius,1.65); actorBlocksMove(from,to,o,radius,1.15)',out=applyDynamicContactCandidate(src,'candidate');
 assert(out.includes('actorBlocksMove(from,to,o,radius,1.65)'));assert(out.includes('actorBlocksMove(from,to,o,radius,1.15)'));
 assert.equal((out.match(/actorBlocksMove3D\(from,to,/g)||[]).length,2);assert.throws(()=>applyDynamicContactCandidate(out,'candidate'));
});
test('overlapping actors can escape but cannot move deeper, and long sweep blocks',()=>{
 assert.equal(actorBlocksMove3D({x:1,z:0},{x:1.5,z:0},actor,flat),false);
 assert.equal(actorBlocksMove3D({x:1,z:0},{x:.5,z:0},actor,flat),true);
 assert.equal(actorBlocksMove3D({x:-8,z:0},{x:8,z:0},actor,flat),true);
});
test('slope sweep is symmetric and separated shelves do not block',()=>{
 const slope=(x,z)=>x*.5;
 assert.equal(actorBlocksMove3D({x:-4,z:0},{x:4,z:0},actor,slope),true);
 assert.equal(actorBlocksMove3D({x:4,z:0},{x:-4,z:0},actor,slope),true);
 const shelf=(x,z)=>z>0?6:0;
 assert.equal(actorBlocksMove3D({x:-4,z:.5},{x:4,z:.5},actor,shelf),false);
});
