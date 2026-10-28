import test from 'node:test';
import assert from 'node:assert/strict';
import {registerFootprint,footprintBoxes,footprintBlocksMove} from '../src/resource-footprint.js';
const tree=()=>({id:'owned-wood',type:'tree',x:0,z:0}),flat=()=>0,boxes=[[[1,0,-1],[2,3,1]]];
test('releasing an owned footprint restores the original resource contact rules',()=>{
 const t=tree(),original=JSON.stringify(t),release=registerFootprint(t,boxes,flat);assert.equal(footprintBlocksMove({x:0,z:0},{x:3,z:0},t),true);assert.equal(typeof release,'function');release();release();assert.equal(footprintBoxes(t),null);assert.equal(footprintBlocksMove({x:0,z:0},{x:3,z:0},t),null);assert.equal(JSON.stringify(t),original);
});
test('a stale footprint cleanup cannot remove a later owner or resurrect a released owner',()=>{
 const t=tree(),releaseA=registerFootprint(t,boxes,flat),releaseB=registerFootprint(t,[[[5,0,-1],[6,3,1]]],flat);assert.equal(typeof releaseA,'function');assert.equal(typeof releaseB,'function');releaseA();assert.deepEqual(footprintBoxes(t),[[[5,0,-1],[6,3,1]]]);releaseB();releaseA();assert.equal(footprintBoxes(t),null);
});
