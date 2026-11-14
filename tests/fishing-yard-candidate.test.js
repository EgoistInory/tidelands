import test from 'node:test';import assert from 'node:assert/strict';import * as T from '../vendor/three.module.min.js';
import {createFishingYardCandidate} from '../tools/fishing_yard_candidate.js';import {cottageSurfaces} from '../src/cottage-surfaces.js';
test('whole yard has grounded supports, finite complete geometry and explicit future collision bounds',()=>{
 const ground=(x,z)=>x*.04+z*.06,kit=createFishingYardCandidate({x:-33,z:77},ground);
 try{assert.equal(kit.posts.length,6);for(const p of kit.posts){assert.equal(p.foot,ground(p.x,p.z));assert(p.top>p.foot);}
  assert(kit.boxes.length>=10);for(const b of kit.boxes){const s=b.getSize(new T.Vector3());assert(s.toArray().every(v=>Number.isFinite(v)&&v>0));}
  assert(kit.root.children.length<=6);for(const m of kit.root.children)assert(m.geometry.attributes.position.array.every(Number.isFinite));
  const size=new T.Box3().setFromObject(kit.root).getSize(new T.Vector3());assert(size.x>8&&size.y>3&&size.z>5,'Must compose a complete yard, not a single miniature prop');
 }finally{kit.release();}
});
test('yard release owns its meshes/net texture but preserves the shared settlement wood map',()=>{
 const shared=cottageSurfaces().wood.map,kit=createFishingYardCandidate();let sharedDisposed=0;shared.addEventListener('dispose',()=>sharedDisposed++);
 kit.release();kit.release();assert.equal(sharedDisposed,0);assert.equal(kit.root.children.length,0);
});
