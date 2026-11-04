import test from 'node:test';import assert from 'node:assert/strict';
import {createWorld,LANDMARKS,terrain} from '../src/world.js';
import {escarpmentPlan,escarpmentGeometry,escarpmentOverlaps} from './escarpment-candidate.js';
test('archived independent-rock planner stays bounded and preserves resources under the current terrain',()=>{
 const world=createWorld(),before=JSON.stringify(world),plan=escarpmentPlan(world.objects);assert(plan.length>=1&&plan.length<=8,`Actual placement count ${plan.length}`);assert.deepEqual(plan,escarpmentPlan(world.objects));assert.equal(JSON.stringify(world),before);
 for(const p of plan){assert(LANDMARKS.every(o=>!escarpmentOverlaps(p,o,o.type==='npc'?18:14)));assert(world.objects.every(o=>!escarpmentOverlaps(p,o,1.5)));
  const g=escarpmentGeometry(p),a=g.attributes.position;assert(a.count>100&&a.count<1000);assert([...a.array].every(Number.isFinite));assert(g.boundingBox.max.y-terrain(p.x,p.z)>2);
  let below=0;for(let i=0;i<a.count;i++)if(a.getY(i)<terrain(a.getX(i),a.getZ(i))-.3)below++;assert(below>20);g.dispose();
 }
});
