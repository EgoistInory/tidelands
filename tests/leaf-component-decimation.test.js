import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshoptSimplifier as M} from '../tools/vendor/meshoptimizer-0.24/meshopt_simplifier.mjs';
import {simplifyLeafComponent} from '../tools/leaf-component-decimation.mjs';
await M.ready;
function sheet(){const p=[],n=[],uv=[],tri=[];for(let y=0;y<5;y++)for(let x=0;x<5;x++){p.push(x/4,y/4,0);n.push(0,0,1);uv.push(x/4,y/4);}for(let y=0;y<4;y++)for(let x=0;x<4;x++){const i=y*5+x;tri.push(i,i+1,i+5,i+1,i+6,i+5);}return {attributes:{POSITION:new Float32Array(p),NORMAL:new Float32Array(n),TEXCOORD_0:new Float32Array(uv)},indices:new Uint32Array(tri)};}
test('real pinned simplifier reduces a planar leaf while keeping full surface and source attributes',()=>{
 const s=sheet(),before=structuredClone(s),r=simplifyLeafComponent(M,s.attributes,s.indices,'near');assert.ok(r.indices.length<s.indices.length);assert.ok(r.indices.length>=6);assert.equal(r.fallbackReason,null);assert.ok(r.maxSourceSampleError<1e-6);assert.deepEqual(s,before);
 const source=new Set(Array.from({length:25},(_,i)=>Object.entries({POSITION:3,NORMAL:3,TEXCOORD_0:2}).flatMap(([k,w])=>Array.from(s.attributes[k].subarray(i*w,i*w+w))).join(',')));
 for(let i=0;i<r.attributes.POSITION.length/3;i++)assert.ok(source.has(Object.entries({POSITION:3,NORMAL:3,TEXCOORD_0:2}).flatMap(([k,w])=>Array.from(r.attributes[k].subarray(i*w,i*w+w))).join(',')));
});
test('entire-leaf deletion or lost surface falls back to the original component',()=>{
 const s=sheet();for(const indices of [new Uint32Array(),new Uint32Array([0,1,5,1,6,5])]){const r=simplifyLeafComponent({simplifyWithAttributes:()=>[indices,0]},s.attributes,s.indices,'mid');assert.ok(r.fallbackReason);assert.deepEqual(r.indices,s.indices);assert.deepEqual(r.attributes,s.attributes);}
});
test('invalid source and level are rejected',()=>{
 const s=sheet();assert.throws(()=>simplifyLeafComponent(M,s.attributes,s.indices,'other'));s.attributes.NORMAL[0]=NaN;assert.throws(()=>simplifyLeafComponent(M,s.attributes,s.indices,'near'));
});
