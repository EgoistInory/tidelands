import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateSurface} from '../tools/exact-surface-dedup.mjs';
const fixture=()=>({POSITION:new Float32Array([0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0]),NORMAL:new Float32Array(Array(6).fill([0,0,1]).flat()),TEXCOORD_0:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1])});
test('identical attribute vertices and cyclic duplicate faces collapse without changing winding',()=>{
 const r=deduplicateSurface(fixture(),new Uint32Array([0,1,2,4,5,3]));assert.equal(r.attributes.POSITION.length,9);assert.deepEqual([...r.indices],[0,1,2]);assert.equal(r.removedFaces,1);
});
test('opposite winding and coincident faces with distinct UV or normals are preserved',()=>{
 let r=deduplicateSurface(fixture(),new Uint32Array([0,1,2,3,5,4]));assert.equal(r.indices.length,6);
 for(const key of ['TEXCOORD_0','NORMAL']){const a=fixture();a[key][key==='NORMAL'?9:6]=.5;r=deduplicateSurface(a,new Uint32Array([0,1,2,3,4,5]));assert.equal(r.indices.length,6);assert.equal(r.removedFaces,0);}
});
test('invalid ranges and nonfinite geometry fail closed',()=>{
 assert.throws(()=>deduplicateSurface(fixture(),new Uint32Array([0,1,99])));const a=fixture();a.POSITION[0]=NaN;assert.throws(()=>deduplicateSurface(a,new Uint32Array([0,1,2])));
});
