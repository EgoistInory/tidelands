import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitLeafPatch} from '../tools/leaf-patch-lod.mjs';

test('alpha leaf patch preserves UV extent and curved source surface without removing leaves',()=>{
  const positions=[],uv=[];
  for(let j=0;j<7;j++)for(let i=0;i<3;i++){
    const v=j/6,u=i/2;positions.push(u*.035,v*.08,.012*(v-.5)**2+.002*u*v);uv.push(.2+u*.3,.1+v*.7);
  }
  for(const segments of [1,2]){
    const result=fitLeafPatch(positions,uv,segments);
    assert.equal(result.indices.length/3,segments*2);assert.equal(result.positions.length/3,(segments+1)*2);
    assert.ok(result.maxSourceError<1e-7,'retain fitted source curvature');
    assert.deepEqual(result.uvBounds,{min:[.2,.1],max:[.5,.7999999999999999]});
    assert.ok(result.positions.every(Number.isFinite)&&result.normals.every(Number.isFinite));
    for(let i=0;i<result.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...result.normals.slice(i,i+3))-1)<1e-6);
  }
});

test('leaf reconstruction rejects bad UV or degenerate surfaces instead of silently deleting a component',()=>{
  assert.throws(()=>fitLeafPatch([0,0,0,1,0,0],[0,0,1,0]),/leaf|UV|surface/i);
  assert.throws(()=>fitLeafPatch(Array(18).fill(0),Array(12).fill(0)),/leaf|UV|surface/i);
  assert.throws(()=>fitLeafPatch([NaN,...Array(17).fill(0)],Array(12).fill(0)),/leaf|UV|surface/i);
});
