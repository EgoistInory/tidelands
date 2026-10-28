import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceFingerprint} from '../tools/exact-surface-dedup.mjs';
const attrs=()=>({POSITION:new Float32Array([0,0,0,1,0,0,0,1,0]),NORMAL:new Float32Array([0,0,1,0,0,1,0,0,1]),TEXCOORD_0:new Float32Array([0,0,1,0,0,1])});
test('fingerprint ignores vertex numbering and cyclic face order',()=>{
 const a=attrs(),b={};for(const [key,w]of Object.entries({POSITION:3,NORMAL:3,TEXCOORD_0:2}))b[key]=new Float32Array([2,0,1].flatMap(i=>Array.from(a[key].subarray(i*w,i*w+w))));
 assert.equal(surfaceFingerprint(a,new Uint32Array([0,1,2])),surfaceFingerprint(b,new Uint32Array([2,0,1])));
});
test('opposite winding, different UV, normals and position remain distinct',()=>{
 const a=attrs(),base=surfaceFingerprint(a,new Uint32Array([0,1,2]));assert.notEqual(base,surfaceFingerprint(a,new Uint32Array([0,2,1])));
 for(const key of ['POSITION','NORMAL','TEXCOORD_0']){const b=attrs();b[key][0]=.01;assert.notEqual(base,surfaceFingerprint(b,new Uint32Array([0,1,2])));}
});
test('fingerprint rejects nonfinite attributes and invalid indices',()=>{
 const a=attrs();assert.throws(()=>surfaceFingerprint(a,new Uint32Array([0,1,6])));a.NORMAL[0]=NaN;assert.throws(()=>surfaceFingerprint(a,new Uint32Array([0,1,2])));
});
