import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const base=process.env.ARCHITECTURE_CANDIDATE_ROOT;
const {buildingModel,WorldView}=await import(base?pathToFileURL(base+'/src/scene.js'):new URL('../src/scene.js',import.meta.url));

test('campfire has rounded crossed fuel logs while retaining the bounded animated plume',()=>{
  const root=buildingModel('campfire');
  const logs=root.children.filter(mesh=>mesh.geometry?.type==='CylinderGeometry'&&mesh.geometry.parameters.height>1);
  assert.ok(logs.length>=3,'rounded fuel logs missing');
  assert.ok(root.userData.flame?.material.isShaderMaterial);
  assert.ok(root.userData.flame.geometry.index.count<=18);
  WorldView.prototype.disposeGroup(root);
});

test('tent canopy is a subdivided draped surface rather than two rigid triangles',()=>{
  const root=buildingModel('tent');
  const panels=root.children.filter(mesh=>mesh.material?.userData.textile);
  assert.ok(panels.some(mesh=>mesh.geometry.attributes.position.count>=100),'draped canopy subdivision missing');
  for(const mesh of panels)for(const name of ['position','normal','uv'])assert.ok([...mesh.geometry.attributes[name].array].every(Number.isFinite));
  WorldView.prototype.disposeGroup(root);
});

test('wood surfaces share maps in one view and release only when the final building releases',()=>{
  const cache=new Map(),a=buildingModel('workbench',cache),b=buildingModel('tent',cache);
  assert.equal(typeof a.userData.releaseSurface,'function','surface lifetime owner missing');
  const maps=root=>{const list=[];root.traverse(o=>{if(o.material?.map?.name==='camp-wood-color')list.push(o.material);});return list;};
  const woodA=maps(a)[0],woodB=maps(b)[0];assert.ok(woodA&&woodB,'bounded timber surface missing');
  assert.notEqual(woodA,woodB);assert.equal(woodA.map,woodB.map);assert.equal(woodA.normalMap,woodB.normalMap);
  assert.equal(woodA.map.image.data.length,128*128*4);assert.equal(woodA.map.generateMipmaps,true);
  assert.notEqual(woodA.map,woodA.normalMap);assert.ok(woodA.roughnessMap);
  let disposed=0;for(const map of [woodA.map,woodA.normalMap,woodA.roughnessMap])map.addEventListener('dispose',()=>disposed++);
  WorldView.prototype.disposeGroup(a);assert.equal(disposed,0);
  WorldView.prototype.disposeGroup(b);assert.equal(disposed,3);b.userData.releaseSurface();assert.equal(disposed,3);
});
