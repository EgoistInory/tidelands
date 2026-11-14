import test from 'node:test';import assert from 'node:assert/strict';
import {coastalRouteLayout,createCoastalRouteCandidate} from '../tools/coastal_route_candidate.js';
import {createWorld,terrain} from '../src/world.js';
test('coastal candidate is deterministic, grounded and keeps existing nodes and camp clear',()=>{
 const world=createWorld(),before=JSON.stringify(world),rows=coastalRouteLayout(world.objects);
 assert(rows.length>15,'Need an actual regional group, not one decoration');assert.deepEqual(rows,coastalRouteLayout(world.objects));
 for(const r of rows){assert.equal(r.y,terrain(r.x,r.z));assert(Math.hypot(r.x+70,r.z-108)>=10+r.radius);assert(world.objects.every(o=>Math.hypot(r.x-o.x,r.z-o.z)>=5+r.radius));}
 assert.equal(JSON.stringify(world),before);
 assert.equal(coastalRouteLayout([],()=>-1).length,0,'Underwater points must be rejected');
});
test('regional visual kit shares three instanced geometries and releases them once',()=>{
 const kit=createCoastalRouteCandidate([],()=>5);assert.equal(kit.root.children.length,3);
 let disposed=0;for(const mesh of kit.root.children){assert(mesh.isInstancedMesh);assert(mesh.count>0);mesh.geometry.addEventListener('dispose',()=>disposed++);mesh.material.addEventListener('dispose',()=>disposed++);}
 kit.release();kit.release();assert.equal(disposed,6);assert.equal(kit.root.children.length,0);
});
