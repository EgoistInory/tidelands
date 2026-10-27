import test from 'node:test';
import assert from 'node:assert/strict';
import {coastalBudgetLevels} from './coastal-level-budget.js';
test('dense coast has at most one near and three mid nodes with stable ID ties',()=>{
  const rows=Array.from({length:20},(_,i)=>({id:'tree-'+String(i).padStart(2,'0'),x:5,z:0})).reverse();
  const levels=coastalBudgetLevels(rows,{x:0,z:0},new Set());
  assert.equal(levels.filter(r=>r.level==='near').length,1);assert.equal(levels.filter(r=>r.level==='mid').length,3);assert.equal(levels.find(r=>r.level==='near').id,'tree-00');
});
test('depleted trees reserve no expensive slots and distant trees hide',()=>{
  const rows=[{id:'cut',x:1,z:0},{id:'next',x:2,z:0},{id:'distant',x:261,z:0}],levels=coastalBudgetLevels(rows,{x:0,z:0},new Set(['cut']));
  assert.equal(levels.find(r=>r.id==='cut').level,'hidden');assert.equal(levels.find(r=>r.id==='next').level,'near');assert.equal(levels.find(r=>r.id==='distant').level,'hidden');assert.deepEqual(rows.map(r=>r.id),['cut','next','distant']);
});
