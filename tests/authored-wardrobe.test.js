import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {dressAuthoredAvatar,WARDROBE_ROLES} from '../src/authored-wardrobe.js';

function model(){
  const root=new THREE.Group(),pelvis=new THREE.Bone(),head=new THREE.Bone(),hand=new THREE.Bone(),spine=new THREE.Bone();
  pelvis.name='pelvis';head.name='Head';hand.name='hand_r';spine.name='spine_03';pelvis.add(head,hand,spine);root.add(pelvis);head.position.y=1.65;hand.position.set(-.75,1.4,0);spine.position.y=1.35;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,1.7,0,.02,1.72,0,-.02,1.72,0, -.73,1.4,0,-.75,1.42,0,-.77,1.4,0, -.12,.6,0,.12,.6,0,0,1.3,0, -.12,.1,0,.12,.1,0,0,.15,.1],3));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,...Array(24).fill(0)],4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(Array.from({length:12},()=>[1,0,0,0]).flat(),4));geometry.setIndex([...Array(12).keys()]);geometry.computeVertexNormals();
  const body=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());body.name='SuperHero_Male';root.add(body);root.updateMatrixWorld(true);body.bind(new THREE.Skeleton([pelvis,head,hand,spine]));return{root,body,head};
}
test('wardrobe keeps source geometry immutable, skin weights normalized, and every role fully dressed',()=>{
  for(const role of Object.keys(WARDROBE_ROLES)){
    const {root,body}=model(),positions=Array.from(body.geometry.attributes.position.array),index=Array.from(body.geometry.index.array);
    const outfit=dressAuthoredAvatar(root,role);
    assert.deepEqual(Array.from(body.geometry.attributes.position.array),positions);assert.deepEqual(Array.from(body.geometry.index.array),index);assert.equal(body.visible,false);
    assert.ok(outfit.getObjectByName('travel-coat'));assert.ok(outfit.getObjectByName('clothed-body'));assert.ok(outfit.getObjectByName('exposed-skin'));assert.ok(root.getObjectByName('travel-pack'));assert.ok(root.getObjectByName('neck-scarf'));
    outfit.traverse(o=>{if(!o.isSkinnedMesh)return;const w=o.geometry.attributes.skinWeight,j=o.geometry.attributes.skinIndex;
      for(let i=0;i<w.count;i++){let total=0;for(let k=0;k<4;k++){total+=w.array[i*4+k];assert.ok(j.array[i*4+k]<o.skeleton.bones.length);}assert.ok(Math.abs(total-1)<1e-6);}assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
    });
    assert.equal(outfit.getObjectByName('exposed-skin').geometry.index.count,6);
  }
});
test('attachments follow the real author bone and duplicate or unknown wardrobe calls fail explicitly',()=>{
  const {root,head}=model();dressAuthoredAvatar(root,'traveler');const pack=root.getObjectByName('travel-pack'),scarf=root.getObjectByName('neck-scarf');assert.equal(pack.parent.name,'spine_03');assert.equal(scarf.parent.name,'spine_03');
  root.updateMatrixWorld(true);const before=pack.getWorldPosition(new THREE.Vector3());pack.parent.rotation.y=.5;root.updateMatrixWorld(true);assert.ok(pack.getWorldPosition(new THREE.Vector3()).distanceTo(before)>.01);
  assert.throws(()=>dressAuthoredAvatar(root,'traveler'),/already/);assert.throws(()=>dressAuthoredAvatar(model().root,'missing'),/Unknown/);
});
test('each hairstyle uses its own author head anchor, including female-authored long hair on a male',async()=>{
  const {attachAuthorHair}=await import('../src/authored-wardrobe.js');
  for(const [role,sourceY]of [['traveler',1.5997999685933693],['botanist',1.549600005756255],['explorer',1.549600005756255]]){
    const {root,head}=model(),hair=new THREE.Group();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,sourceY,role==='traveler'?-.017399985977202482:-.010899782225668054],3));hair.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial()));
    const attached=attachAuthorHair(root,hair,role);root.updateMatrixWorld(true);const point=new THREE.Vector3().fromBufferAttribute(attached.geometry.attributes.position,0).applyMatrix4(attached.matrixWorld);assert.ok(point.distanceTo(head.getWorldPosition(new THREE.Vector3()))<1e-6);
  }
});
test('hair retains source node rotation and centimetre scale before binding to the target Head',async()=>{
 const {attachAuthorHair}=await import('../src/authored-wardrobe.js'),{root,head}=model(),hair=new THREE.Group(),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,-.010899782225668054*100,-1.549600005756255*100],3));const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.rotation.x=Math.PI/2;mesh.scale.setScalar(.01);hair.add(mesh);
 const result=attachAuthorHair(root,hair,'botanist');root.updateMatrixWorld(true);const p=new THREE.Vector3().fromBufferAttribute(result.geometry.attributes.position,0).applyMatrix4(result.matrixWorld);assert.ok(p.distanceTo(head.getWorldPosition(new THREE.Vector3()))<1e-6);
});
