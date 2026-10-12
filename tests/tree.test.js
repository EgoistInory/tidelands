import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createTree} from '../src/tree.js';
import {barkSurface} from '../src/foliage.js';
import {mergeStaticParts} from '../src/merge-parts.js';

test('organic tree keeps a narrow rooted trunk and finite nondegenerate branching geometry',()=>{
  const tree=createTree(),trunk=tree.getObjectByName('tree-trunk');
  assert.ok(trunk?.isMesh);assert.equal(trunk.material,barkSurface());
  const p=trunk.geometry.attributes.position;
  const low=[],high=[];
  for(let i=0;i<p.count;i++){
    const radius=Math.hypot(p.getX(i),p.getZ(i));
    if(p.getY(i)<.1)low.push(radius);
    if(p.getY(i)>6.5)high.push(radius);
  }
  assert.ok(Math.max(...low)<.65&&Math.max(...low)>.48,'roots fit the existing trunk clearance');
  assert.ok(Math.max(...high)<.3,'upper trunk tapers');
  tree.traverse(mesh=>{if(!mesh.isMesh)return;
    assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
    const index=mesh.geometry.index,positions=mesh.geometry.attributes.position,count=index?.count??positions.count;
    for(let i=0;i<count;i+=3){
      const [a,b,c]=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+n):i+n));
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-16,'no collapsed branch or leaf triangle');
    }
  });
  for(const limb of tree.children.filter(m=>m.name==='tree-branch')){
    const bounds=new THREE.Box3().setFromObject(limb);assert.ok(bounds.min.y>3,'branches leave the walking/camera space open');
  }
});

test('branching tree is deterministic and retains two shared instanced surfaces after merging',()=>{
  const a=createTree(),b=createTree();
  assert.equal(a.children.length,b.children.length);
  a.children.forEach((mesh,i)=>{
    assert.deepEqual(mesh.geometry.attributes.position.array,b.children[i].geometry.attributes.position.array);
    assert.equal(mesh.material,b.children[i].material);
  });
  a.updateMatrixWorld(true);mergeStaticParts(a);
  assert.equal(a.children.length,2,'branch detail does not add world draw calls');
  const leaves=a.children.find(m=>m.material.alphaTest>0),wood=a.children.find(m=>m.material.alphaTest===0);
  assert.ok(leaves.customDepthMaterial&&leaves.customDepthMaterial.map===leaves.material.map);
  assert.equal(wood.material,barkSurface());
  assert.ok(wood.geometry.index.count/3<1600,'bounded branch triangle budget');
});
