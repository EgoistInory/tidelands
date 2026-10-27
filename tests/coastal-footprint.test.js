import test from 'node:test';
import assert from 'node:assert/strict';
import {registerFootprint,footprintBoxes,copyFootprint,footprintBlocksMove,footprintReach,footprintIntersectsBuilding,mergeFootprintCells,footprintGatherTarget} from './coastal-resource-footprint.js';
const flat=()=>0,tree=()=>({id:'test-tree',type:'tree',x:0,z:0});
const fork=[[[-3,0,-.3],[-2,2,.3]],[[2,0,-.3],[3,2,.3]]];
test('swept bodies stop on low limbs but can pass through a real open fork',()=>{
  const t=tree();registerFootprint(t,fork,flat);
  assert.equal(footprintBlocksMove({x:0,z:-2},{x:0,z:2},t,.35),false);
  assert.equal(footprintBlocksMove({x:2.5,z:-2},{x:2.5,z:2},t,.35),true);
  assert.equal(footprintBlocksMove({x:6,z:0},{x:4,z:0},t,.35),false);
});
test('vertical filtering follows ground height rather than blocking every branch projection',()=>{
  const t=tree();registerFootprint(t,[[[2,4,-.3],[3,5,.3]]],flat);
  assert.equal(footprintBlocksMove({x:2.5,z:-2},{x:2.5,z:2},t),false);
  const raised=tree();registerFootprint(raised,[[[2,4,-.3],[3,5,.3]]],()=>2);
  assert.equal(footprintBlocksMove({x:2.5,z:-2},{x:2.5,z:2},raised),true);
});
test('legacy overlaps can escape outward without allowing inward penetration',()=>{
  const t=tree();registerFootprint(t,[[[2,0,-1],[3,2,1]]],flat);
  assert.equal(footprintBlocksMove({x:2.5,z:0},{x:3,z:0},t),false);
  assert.equal(footprintBlocksMove({x:2.5,z:0},{x:2,z:0},t),true);
});
test('gather snapshots retain geometry without serializing or sharing contacts across IDs',()=>{
  const t=tree(),before=JSON.stringify(t);registerFootprint(t,fork,flat);
  assert.equal(JSON.stringify(t),before);assert.equal(footprintReach({x:4,z:0},t),2.8);
  const snapshot=copyFootprint(t,{...t});assert.equal(footprintReach({x:4,z:0},snapshot),2.8);
  assert.equal(footprintReach({x:4,z:0},{...t}),null);
  assert.throws(()=>registerFootprint(t,[[[NaN,0,0],[1,1,1]]],flat));
  assert.equal(footprintBoxes(t).length,2);
});
test('building clearance reserves actual low wood even during regrowth and leaves gaps open',()=>{
  const t=tree();registerFootprint(t,[[[4,0,-.2],[4.4,2,.2]]],flat);
  assert.equal(footprintIntersectsBuilding(t,{type:'campfire',x:4,z:1}),true);
  assert.equal(footprintIntersectsBuilding(t,{type:'campfire',x:0,z:0}),false);
  assert.equal(footprintIntersectsBuilding({...t},{type:'campfire',x:4,z:1}),null);
});
test('rotated sparse branch contacts do not fill their enclosing world rectangle',()=>{
  const t=tree();registerFootprint(t,[[[0,0,-.1],[4,2,.1]]],flat,{x:0,y:0,z:0,rotation:Math.PI/4,scale:1});
  assert.equal(footprintBlocksMove({x:2.5,z:.5},{x:2.5,z:-.5},t),false);
  assert.equal(footprintBlocksMove({x:.5,z:-1.4},{x:2.5,z:-1.4},t),true);
});
test('cell merging preserves exact occupied volume and a separated fork gap',()=>{
  const cells=[[0,0,0],[1,0,0],[0,0,1],[1,0,1],[4,0,0]],boxes=mergeFootprintCells(cells,1);
  assert.equal(boxes.length,2);assert.equal(boxes.reduce((n,[a,b])=>n+(b[0]-a[0])*(b[1]-a[1])*(b[2]-a[2]),0),5);
  assert(boxes.every(([a,b])=>!(a[0]<3&&b[0]>3)));
});
test('the action and feedback aim at the reachable low wood rather than an empty resource centre',()=>{
  const t=tree();registerFootprint(t,[[[2,0,-.2],[3,2,.2]]],flat);
  assert.deepEqual(footprintGatherTarget({x:4,z:0},t),{x:3,y:1.1,z:0});
  assert.equal(footprintGatherTarget({x:4,z:0},{...t}),null);
});
