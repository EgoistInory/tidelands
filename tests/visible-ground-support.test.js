import {test} from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';import * as support from './visible-ground-sampler.js';
import {terrain,createWorld} from '../src/world.js';import {createMeadow} from '../src/meadow.js';
function grid(){const g=new THREE.PlaneGeometry(800,800,320,320);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,terrain(p.getX(i),p.getZ(i)));return g;}
test('decorative root candidate uses visible triangle support and preserves every non-Y matrix value',()=>{
 assert.equal(typeof support.buildGroundRootVariants,'function','ground-support candidate missing');
 const world=createWorld(),frozen=JSON.stringify(world.objects),batches=createMeadow(undefined,world.objects),originals=batches.map(b=>b.instanceMatrix.array.slice());
 const result=support.buildGroundRootVariants(batches,grid());assert.equal(JSON.stringify(world.objects),frozen);assert.equal(result.variants.length,batches.length);
 assert.ok(result.before.maxRootGap>.3);assert.ok(result.after.maxRootGap<-.0349);assert.equal(result.after.instances,result.before.instances);assert.equal(result.after.instances,105721);
 for(let k=0;k<batches.length;k++){assert.deepEqual(batches[k].instanceMatrix.array,originals[k],'preparation must not mutate visible instances');const v=result.variants[k];for(let i=0;i<v.after.length;i++)if(i%16!==13)assert.equal(v.after[i],v.before[i]);}
});
test('ground sampler agrees with real triangle hits rather than interpolated cell corners on one diagonal',()=>{
 const g=grid(),sample=support.visibleGroundSampler(g),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);
 for(const [x,z]of [[-41.4534111,-208.3750763],[-111.45165,-250.7369],[13.13,75.77],[-96.4,-239.2]]){ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));assert.ok(Math.abs(sample(x,z)-ray.intersectObject(mesh,false)[0].point.y)<1e-5);}
 assert.equal(sample(401,0),null);assert.ok(Number.isFinite(sample(400,400)));
});
