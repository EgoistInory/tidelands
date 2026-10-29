import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';import {terrain,createWorld,randomGenerator} from '../src/world.js';import {createMeadow,updateCampClearance} from '../src/meadow.js';
import {visibleGroundSampler,buildGroundRootVariants} from './visible-ground-sampler.js';
function surface(){const g=new THREE.PlaneGeometry(800,800,320,320);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,terrain(p.getX(i),p.getZ(i)));return visibleGroundSampler(g);}
test('production meadow initialization matches reviewed Float32 Y results and consumes unchanged random draws',()=>{
 const world=createWorld(),frozen=JSON.stringify(world.objects),sample=surface(),random=randomGenerator(4321);let queries=0;
 const actual=createMeadow(random,world.objects,(x,z)=>{queries++;return sample(x,z);});
 assert.ok(queries>105636,'production did not use actual visible terrain');
 const baseline=createMeadow(undefined,world.objects),grid=new THREE.PlaneGeometry(800,800,320,320);grid.rotateX(-Math.PI/2);const p=grid.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,terrain(p.getX(i),p.getZ(i)));
 const reviewed=buildGroundRootVariants(baseline,grid);assert.equal(actual.length,reviewed.variants.length);
 for(let k=0;k<actual.length;k++){const a=actual[k],b=reviewed.variants[k];assert.equal(a.name,b.batch.name);assert.equal(a.count,b.batch.count);assert.deepEqual(a.instanceMatrix.array,b.after);assert.deepEqual(a.instanceColor?.array,b.batch.instanceColor?.array);assert.ok(a.boundingBox&&a.boundingSphere);}
 assert.equal(random(),.67249841010198);assert.equal(JSON.stringify(world.objects),frozen);
});
test('actual scenery routes the visible sampler into meadow construction and camp clearance restores corrected matrices',()=>{
 const world=createWorld(),sample=surface(),view={world,scene:new THREE.Scene(),groundHeight:sample};WorldView.prototype.createScenery.call(view);
 const b=view.meadow.find(b=>b.name==='meadow-grass'),original=b.instanceMatrix.array.slice(),matrix=new THREE.Matrix4();b.getMatrixAt(0,matrix);
 const x=matrix.elements[12],z=matrix.elements[14];assert.ok(Math.abs(matrix.elements[13]-(terrain(x,z)-.04))>1e-4,'scenery retained analytic-only root translation');
 assert.ok(updateCampClearance(view.meadow,[{type:'campfire',x,z}])>0);assert.ok(b.userData.campHidden.size>0);
 updateCampClearance(view.meadow,[]);assert.deepEqual(b.instanceMatrix.array,original);
});
