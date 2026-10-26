import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createWorld} from '../src/world.js';
import {createTree,TREE_FORMS} from '../src/tree.js';
import {classifyTrees,createCompositionTree} from './canopy-composition-candidate.js';

test('spatial canopy cohorts are deterministic, retain save nodes and protect starter clearance',()=>{
  const world=createWorld(),snapshot=JSON.stringify(world),rows=classifyTrees(world.objects);
  assert.equal(JSON.stringify(world),snapshot);assert.equal(rows.length,world.objects.filter(o=>o.type==='tree').length);
  assert.deepEqual(rows,classifyTrees(world.objects));
  for(const row of rows)assert.ok(world.objects.includes(row.node));
  for(const cohort of ['mature','edge','young','retained'])assert.ok(rows.some(r=>r.cohort===cohort),cohort);
  assert.ok(rows.filter(r=>r.node.id.startsWith('starter-')).every(r=>r.cohort==='retained'));
});

test('all regional cohorts preserve rooted walk space, topology, shared wind and finite bounds',()=>{
  for(const form of TREE_FORMS){
    const original=createTree(form),originalBox=new THREE.Box3().setFromObject(original);
    for(const cohort of ['mature','edge','young','retained']){
      const candidate=createCompositionTree(form,cohort),box=new THREE.Box3().setFromObject(candidate);
      assert.equal(candidate.children.length,original.children.length);
      candidate.children.forEach((mesh,j)=>{
        const source=original.children[j],a=source.geometry.attributes.position,b=mesh.geometry.attributes.position;
        assert.equal(a.count,b.count);assert.equal(mesh.material,source.material);assert.equal(mesh.customDepthMaterial,source.customDepthMaterial);
        assert.ok(b.array.every(Number.isFinite));assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
        for(let i=0;i<a.count;i++)if(a.getY(i)<=2.4)assert.deepEqual([b.getX(i),b.getY(i),b.getZ(i)],[a.getX(i),a.getY(i),a.getZ(i)]);
      });
      assert.ok(box.max.y<originalBox.max.y*1.1);
      if(cohort==='mature')assert.ok(box.max.x-box.min.x>(originalBox.max.x-originalBox.min.x)*1.2,'mature canopy changes whole silhouette');
      if(cohort==='young')assert.ok(box.max.y<originalBox.max.y*.85,'young edge has a distinct height layer');
    }
  }
});
