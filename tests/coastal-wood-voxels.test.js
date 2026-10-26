import test from 'node:test';
import assert from 'node:assert/strict';
import {woodySurfaceVoxels} from '../tools/coastal-wood-voxels.mjs';

test('thin separated branches retain their surfaces and leave the open centre empty',()=>{
  const p=[-2,1,0,-2,1.5,0,-2,1,.5,2,1,0,2,1.5,0,2,1,.5],rows=woodySurfaceVoxels(p,[0,1,2,3,4,5],.25);
  assert(rows.length>0);assert(rows.every(([x])=>Math.abs(x)>=7));
  const covers=point=>rows.some(row=>row.every((v,i)=>point[i]>=v*.25-1e-10&&point[i]<=(v+1)*.25+1e-10));
  for(const x of [-2,2])for(let a=0;a<=10;a++)for(let b=0;b<=10-a;b++)assert(covers([x,1+a*.05,b*.05]));
  assert(!covers([0,1.1,.1]));
});
test('axis-plane boundary coverage is deterministic on both adjoining cells',()=>{
  const p=[0,0,0,0,1,0,0,0,1],ix=[0,1,2],a=woodySurfaceVoxels(p,ix,.5);
  assert(a.some(r=>r[0]===-1));assert(a.some(r=>r[0]===0));assert.deepEqual(a,woodySurfaceVoxels(p,ix,.5));
});
test('invalid inputs and unbounded voxel workloads are rejected',()=>{
  for(const args of [[[NaN,0,0,0,1,0,0,0,1],[0,1,2],.2],[[0,0,0,0,1,0,0,0,1],[0,1,3],.2],[[0,0,0,100,1,0,0,0,100],[0,1,2],.001]])assert.throws(()=>woodySurfaceVoxels(...args));
});
