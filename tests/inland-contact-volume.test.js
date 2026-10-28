import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from '../vendor/three.module.min.js';
import {woodyInteriorCells} from '../tools/inland-contact-volume.mjs';
function cubes(offsets){const positions=[],indices=[];for(const x of offsets){const g=new BoxGeometry(1,2,1);g.translate(x,1,0);const start=positions.length/3;positions.push(...g.attributes.position.array);indices.push(...Array.from(g.index.array,i=>i+start));}return [new Float32Array(positions),new Uint32Array(indices)];}
test('solid trunk interior is occupied while gaps between separate wooden pieces stay open',()=>{
 const [p,i]=cubes([-2,2]),r=woodyInteriorCells(p,i,.2),keys=new Set(r.cells.map(c=>c.join(',')));assert.ok(keys.has('10,5,0'));assert.ok(keys.has('-10,5,0'));assert.ok(!keys.has('0,5,0'));assert.equal(r.unbalancedLines,0);
});
test('an open scan line does not invent interior volume',()=>{
 const [p,i]=cubes([0]),r=woodyInteriorCells(p,i.slice(6),.2);assert.ok(r.unbalancedLines>0);assert.ok(!r.cells.some(c=>c[0]===0&&c[1]===5&&c[2]===0));
});
test('invalid geometry and excessive interior spans fail closed',()=>{
 const [p,i]=cubes([0]);assert.throws(()=>woodyInteriorCells(p,new Uint32Array([0,1,999]),.2));for(let v=0;v<p.length;v+=3)p[v]*=1e9;assert.throws(()=>woodyInteriorCells(p,i,.2),/budget/);
});
