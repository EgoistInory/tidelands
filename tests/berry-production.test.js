import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createWorld} from '../src/world.js';
import {createBerryBush as candidate} from './resource-detail-candidate.js';

test('actual scenery instancing adopts the reviewed berry geometry at every original node',()=>{
  const world=createWorld(),before=JSON.stringify(world.objects),view={world,scene:new THREE.Scene()};WorldView.prototype.createScenery.call(view);
  const batches=view.batches.filter(b=>b.entries[0]?.type==='berry'),model=candidate(),nodes=world.objects.filter(o=>o.type==='berry');
  assert.equal(batches.length,3);assert.ok(nodes.length>50);assert.equal(JSON.stringify(world.objects),before);
  for(let i=0;i<3;i++){
    const {batch,entries}=batches[i];assert.deepEqual(batch.geometry.attributes.position.array,model.children[i].geometry.attributes.position.array);assert.deepEqual(batch.geometry.attributes.color.array,model.children[i].geometry.attributes.color.array);
    assert.deepEqual(entries.map(n=>n.id),nodes.map(n=>n.id));assert.equal(batch.material.transparent,false);
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    for(let k=0;k<entries.length;k++){batch.getMatrixAt(k,m);m.decompose(p,q,s);const o=entries[k];assert.ok(Math.abs(p.x-o.x)<1e-4&&Math.abs(p.y-o.y)<1e-4&&Math.abs(p.z-o.z)<1e-4);assert.ok(Math.abs(s.x-o.scale)<1e-5&&Math.abs(s.y-o.scale)<1e-5&&Math.abs(s.z-o.scale)<1e-5);}
  }
});
