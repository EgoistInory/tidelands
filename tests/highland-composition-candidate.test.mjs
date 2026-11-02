import test from 'node:test';import assert from 'node:assert/strict';import {createWorld,LANDMARKS,ISLANDS} from '../src/world.js';import {highlandGroundPlan} from './highland-composition-candidate.js';
test('highland ground composition is deterministic, bounded and preserves all resource records',()=>{
 const world=createWorld(),frozen=JSON.stringify(world),plan=highlandGroundPlan(world.objects);assert.deepEqual(plan,highlandGroundPlan(world.objects));assert.equal(JSON.stringify(world),frozen);assert(plan.minerals.length>10);assert(plan.ferns.length>0&&plan.ferns.length<=200);
 for(const p of plan.ferns){assert(p.height>=.25&&p.height<=.55);assert(LANDMARKS.every(o=>Math.hypot(o.x-p.x,o.z-p.z)>=12));for(const a of LANDMARKS.filter(o=>Math.hypot(o.x-ISLANDS[2].x,o.z-ISLANDS[2].z)<ISLANDS[2].r)){const b=ISLANDS[2],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));assert(Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)>=4);}}
});
