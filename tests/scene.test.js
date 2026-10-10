import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {buildingModel,WorldView} from '../src/scene.js';
import {terrain,createWorld,LANDMARKS} from '../src/world.js';
import {freshGame,serialize} from '../src/game.js';
import {animateCreature,createCreature} from '../src/creature.js';

test('islanders respond to a nearby conversation target without moving or changing the save',()=>{
  const view={world:createWorld(),scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};
  WorldView.prototype.createScenery.call(view);
  const keeper=LANDMARKS.find(o=>o.id==='keeper'),state=freshGame();
  Object.assign(state.player,{x:keeper.x+4,z:keeper.z});
  const before=serialize(state),residents=view.scene.children.filter(g=>g.userData.ankles);
  const positions=residents.map(g=>g.position.clone()),arms=residents.map(g=>g.userData.shoulders[0].rotation.z);
  for(let frame=0;frame<120;frame++)WorldView.prototype.updateIslanders.call(view,state,keeper,1/60);
  assert.equal(serialize(state),before);
  const model=residents.find(g=>g.position.x===keeper.x&&g.position.z===keeper.z);
  assert.ok(Math.abs(model.rotation.y-Math.PI/2)<1e-5);
  assert.equal(model.userData.axe.visible,false);assert.equal(model.userData.sword.visible,false);
  assert.ok(residents.some((g,i)=>g.userData.shoulders[0].rotation.z!==arms[i]));
  residents.forEach((g,i)=>assert.ok(g.position.equals(positions[i])));
  const restingArm=model.userData.shoulders[0].rotation.z;
  state.time+=1;const advancedSave=serialize(state);
  WorldView.prototype.updateIslanders.call(view,state,keeper,1/60);
  assert.notEqual(model.userData.shoulders[0].rotation.z,restingArm);
  assert.equal(serialize(state),advancedSave);
  const facing=model.rotation.y;
  Object.assign(state.player,{x:keeper.x-30,z:keeper.z});
  WorldView.prototype.updateIslanders.call(view,state,keeper,1/60);
  assert.ok(Math.abs(model.rotation.y-facing)<1e-8,'distant targets do not turn an islander');
  assert.equal(view.scene.children.filter(g=>g.userData.ankles).length,3);
});

test('tree camera bounds preserve empty ground below the crown while blocking trunk and foliage',()=>{
  const world=createWorld(),view={world,scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};
  WorldView.prototype.createScenery.call(view);
  const tree=world.objects.find(o=>o.id==='resource-1216'),entry=view.cameraObstacles.find(e=>e.object===tree),boxes=entry.boxes??[entry.box];
  const focus=new THREE.Vector3(-93.14281767330489,16.923718645934418,-47.20242729019003),previous=new THREE.Vector3(-104.39635349232081,23.115108555088995,-37.68271992895266);
  const ray=new THREE.Ray(focus,previous.clone().sub(focus).normalize());
  for(const box of boxes){const hit=ray.intersectBox(box,new THREE.Vector3());assert.ok(!hit||focus.distanceTo(hit)>2,'empty space near the player must not collide with a ground-to-crown box');}
  const trunkRay=new THREE.Ray(new THREE.Vector3(tree.x-10,tree.y+2.4,tree.z),new THREE.Vector3(1,0,0));
  assert.ok(boxes.some(box=>trunkRay.intersectBox(box,new THREE.Vector3())),'the solid trunk still blocks the camera');
  const leafBatch=view.batches.find(({entries,batch})=>entries.some(o=>o===tree)&&batch.material.alphaTest>0);
  const index=leafBatch.entries.indexOf(tree),matrix=new THREE.Matrix4();leafBatch.batch.getMatrixAt(index,matrix);
  const crown=leafBatch.batch.geometry.boundingBox.clone().applyMatrix4(matrix),center=crown.getCenter(new THREE.Vector3());
  const crownRay=new THREE.Ray(new THREE.Vector3(crown.min.x-5,center.y,center.z),new THREE.Vector3(1,0,0));
  assert.ok(boxes.some(box=>crownRay.intersectBox(box,new THREE.Vector3())),'the crown still blocks the camera');
});

test('distant geometry is shared until the last owner leaves, while materials remain private',()=>{
  const cache=new Map(),a=createCreature('boar',cache),b=createCreature('boar',cache);
  const ag=a.userData.distant.children,bg=b.userData.distant.children;
  let released=0;
  for(let i=0;i<ag.length;i++){
    assert.equal(ag[i].geometry,bg[i].geometry);assert.notEqual(ag[i].material,bg[i].material);
    ag[i].geometry.addEventListener('dispose',()=>released++);
  }
  WorldView.prototype.disposeGroup(a);assert.equal(released,0);assert.equal(cache.get('boar').references,1);
  b.userData.hide.emissive.setRGB(.2,0,0);assert.equal(a.userData.hide.emissive.r,0);
  WorldView.prototype.disposeGroup(b);assert.equal(released,ag.length);assert.equal(cache.size,0);
  const c=createCreature('boar',cache);assert.notEqual(c.userData.distant.children[0].geometry,ag[0].geometry);
  WorldView.prototype.disposeGroup(c);assert.equal(cache.size,0);
});

test('resource bounds retain regenerating nodes after initial depletion',()=>{
  const world=createWorld(),view={world,scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};
  WorldView.prototype.createScenery.call(view);
  const residents=view.scene.children.filter(g=>g.userData.ankles);assert.equal(residents.length,3);
  for(const resident of residents){
    resident.updateMatrixWorld(true);
    for(const ankle of resident.userData.ankles){
      const point=ankle.getWorldPosition(new THREE.Vector3()),soleUp=new THREE.Vector3(0,1,0).applyQuaternion(ankle.getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(Math.abs((point.y-terrain(point.x,point.z))*soleUp.y-.145)<1e-8);
    }
  }
  const leaves=view.batches.filter(({batch})=>batch.material.alphaTest>0);
  assert.deepEqual(new Set(leaves.flatMap(({entries})=>entries.map(e=>e.type))),new Set(['tree','berry']));
  for(const {batch}of leaves){assert.ok(batch.customDepthMaterial);assert.equal(batch.customDepthMaterial.map,batch.material.map);}
  const bounds=view.batches.map(({batch})=>batch.boundingSphere.clone());
  const ids=new Set();
  for(const {entries} of view.batches){
    entries.forEach(e=>ids.add(e.id));
  }
  assert.equal(ids.size,world.objects.length);
  const nodes=['tree','berry','stone','fiber'].map(type=>world.objects.find(o=>o.type===type)),state={buildings:[],enemies:[],time:100,depleted:Object.fromEntries(nodes.map(node=>[node.id,200]))};
  WorldView.prototype.sync.call(view,state);
  const matrix=new THREE.Matrix4();
  for(const node of nodes)for(const {batch,entries} of view.batches){
    const index=entries.findIndex(e=>e.id===node.id);if(index<0)continue;
    batch.getMatrixAt(index,matrix);assert.equal(matrix.determinant(),0);
  }
  state.time=201;WorldView.prototype.sync.call(view,state);
  view.batches.forEach(({batch},i)=>assert.ok(batch.boundingSphere.equals(bounds[i])));
  for(const node of nodes)for(const {batch,entries} of view.batches){
    const index=entries.findIndex(e=>e.id===node.id);if(index<0)continue;
    batch.getMatrixAt(index,matrix);assert.ok(matrix.determinant()>0);
  }
});

test('save replacement releases creatures and resets transient death/hit animation',()=>{
  const view={batches:[],buildings:new Map(),creatures:new Map(),scene:new THREE.Scene(),disposeGroup:WorldView.prototype.disposeGroup};
  const state={buildings:[],enemies:[{id:'enemy-0',type:'boar',x:0,z:0,hp:70}]};
  WorldView.prototype.sync.call(view,state);const old=view.creatures.get('enemy-0');
  animateCreature(old,state.enemies[0],100,.016,0,{x:0,z:5});
  state.enemies[0].hp=0;animateCreature(old,state.enemies[0],101,.016,0,{x:0,z:5});
  view.hurtAt=101;view.gatherAt=100;
  WorldView.prototype.sync.call(view,state);assert.equal(view.creatures.get('enemy-0'),old);
  assert.equal(view.hurtAt,101);assert.equal(view.gatherAt,100);
  let released=0;old.userData.hide.addEventListener('dispose',()=>released++);
  const imported={buildings:[],enemies:[{...state.enemies[0],type:'crab'}]};
  WorldView.prototype.sync.call(view,imported);const current=view.creatures.get('enemy-0');
  assert.equal(view.hurtAt,-100);assert.equal(view.gatherAt,-100);
  assert.notEqual(current,old);assert.equal(released,1);assert.equal(current.userData.type,'crab');
  animateCreature(current,imported.enemies[0],10,.016,0,{x:0,z:5});assert.equal(current.visible,false);
  assert.equal(view.scene.children.length,1);
  imported.enemies=[];WorldView.prototype.sync.call(view,imported);assert.equal(view.scene.children.length,0);
});

for(const type of ['boar','crab'])test(`${type}: near geometry shares a lifetime while pose and hit materials remain private`,()=>{
  const cache=new Map(),a=createCreature(type,cache),b=createCreature(type,cache);
  const meshes=root=>{const result=[];root.traverse(part=>{if(part.isMesh)result.push(part);});return result;};
  const am=meshes(a.userData.body),bm=meshes(b.userData.body);
  assert.equal(am.length,bm.length);
  assert.ok(am.every((part,i)=>part.geometry===bm[i].geometry),'same-type near bodies must share immutable vertex/index buffers');
  assert.ok(am.every((part,i)=>part!==bm[i]&&part.material!==bm[i].material),'transforms and damage materials remain per creature');
  const bytes=am.map(part=>Array.from(part.geometry.attributes.position.array));
  const e={x:0,z:0,hp:70,attackAt:-100};
  animateCreature(a,e,10,.016,0,{x:0,z:8});
  animateCreature(a,{...e,x:.2,hp:10,attackAt:10},10.175,.016,0,{x:0,z:8});
  assert.equal(b.userData.phase,0);assert.equal(b.userData.hide.emissive.r,0);
  assert.deepEqual(am.map(part=>Array.from(part.geometry.attributes.position.array)),bytes,'animation must not mutate shared vertices');
  const geometries=new Set(am.map(part=>part.geometry));let geometryDisposals=0,privateDisposals=0;
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++);
  a.userData.hide.addEventListener('dispose',()=>privateDisposals++);
  WorldView.prototype.disposeGroup(a);assert.equal(geometryDisposals,0);assert.equal(privateDisposals,1);assert.equal(cache.get(type).references,1);
  animateCreature(b,e,11,.016,0,{x:0,z:8});assert.equal(b.visible,true);
  WorldView.prototype.disposeGroup(b);assert.equal(geometryDisposals,geometries.size);assert.equal(cache.size,0);
  const rebuilt=createCreature(type,cache),rebuiltMeshes=meshes(rebuilt.userData.body);
  assert.ok(rebuiltMeshes.every(part=>!geometries.has(part.geometry)),'a released template must never be reused');
  WorldView.prototype.disposeGroup(rebuilt);assert.equal(cache.size,0);
});

test('same-type save replacement reuses creature models without carrying over animation or damage',()=>{
  const view={batches:[],buildings:new Map(),creatures:new Map(),scene:new THREE.Scene(),disposeGroup:WorldView.prototype.disposeGroup};
  const state={buildings:[],enemies:[{id:'a',type:'boar',x:0,z:0,hp:70},{id:'b',type:'crab',x:0,z:0,hp:40}]};
  WorldView.prototype.sync.call(view,state);const models=new Map(view.creatures);
  let released=0;for(const model of models.values())model.userData.hide.addEventListener('dispose',()=>released++);
  for(const enemy of state.enemies){
    const model=models.get(enemy.id);
    animateCreature(model,enemy,100,.016,0,{x:0,z:5});
    animateCreature(model,{...enemy,x:.2,hp:10,attackAt:100},100.175,.016,0,{x:0,z:5});
    animateCreature(model,{...enemy,x:.2,hp:0},101,.016,0,{x:0,z:5});
    animateCreature(model,{...enemy,x:.2,hp:0},102,.016,0,{x:0,z:5});
    assert.equal(model.visible,false);
  }
  view.gatherAt=101;view.hurtAt=101;
  const imported={buildings:[],enemies:[{...state.enemies[0],x:10,z:20},{...state.enemies[1],x:12,z:20,hp:0}]};
  const saved=JSON.stringify(imported);
  WorldView.prototype.sync.call(view,imported);
  assert.equal(JSON.stringify(imported),saved);assert.equal(released,0);
  assert.equal(view.gatherAt,-100);assert.equal(view.hurtAt,-100);
  const pose=model=>{const u=model.userData;return {position:model.position.toArray(),rotation:model.rotation.toArray(),visible:model.visible,phase:u.phase,last:u.last,hp:u.hp,hitAt:u.hitAt,deadAt:u.deadAt,far:u.far,emissive:u.hide.emissive.toArray(),body:[u.body.position.toArray(),u.body.rotation.toArray(),u.body.visible],distant:[u.distant.position.toArray(),u.distant.rotation.toArray(),u.distant.visible],legs:u.legs.map(g=>g.rotation.toArray()),claws:u.claws.map(g=>[g.rotation.toArray(),g.userData.pincer.rotation.toArray()])};};
  for(const enemy of imported.enemies){
    const current=view.creatures.get(enemy.id),original=models.get(enemy.id);
    assert.ok(current===original,'a same-id/type save change must reuse the existing geometry and private materials');
    const fresh=createCreature(enemy.type);
    animateCreature(current,enemy,10,.016,2,{x:10,z:25});animateCreature(fresh,enemy,10,.016,2,{x:10,z:25});
    assert.deepEqual(pose(current),pose(fresh));
    WorldView.prototype.disposeGroup(fresh);
  }
  assert.equal(view.scene.children.length,2);
  imported.enemies=[];WorldView.prototype.sync.call(view,imported);
  assert.equal(view.scene.children.length,0);assert.equal(view.creatureGeometryCache.size,0);assert.equal(released,2);
});

test('loading a different save updates buildings even when IDs are reused',()=>{
  const view={batches:[],buildings:new Map(),creatures:new Map(),scene:new THREE.Scene(),disposeGroup:WorldView.prototype.disposeGroup};
  const state={buildings:[{id:'built-0',type:'tent',x:-70,z:100}],enemies:[]};
  WorldView.prototype.sync.call(view,state);
  const original=view.buildings.get('built-0');
  state.buildings[0]={id:'built-0',type:'tent',x:-90,z:80};
  WorldView.prototype.sync.call(view,state);
  assert.equal(view.buildings.get('built-0'),original);
  assert.deepEqual(original.position.toArray(),[-90,terrain(-90,80),80]);
  let disposed=0;original.children[0].geometry.addEventListener('dispose',()=>disposed++);
  state.buildings[0].type='workbench';WorldView.prototype.sync.call(view,state);
  assert.notEqual(view.buildings.get('built-0'),original);assert.equal(disposed,1);
  assert.equal(view.scene.children.length,1);assert.equal(view.buildings.get('built-0').userData.buildingType,'workbench');
  state.buildings=[];WorldView.prototype.sync.call(view,state);
  assert.equal(view.scene.children.length,0);assert.equal(view.buildings.size,0);
});

test('campfire flames emit light without changing shared building materials',()=>{
  const camp=buildingModel('campfire'),bench=buildingModel('workbench');
  const flames=camp.children.filter(o=>o.material.emissiveIntensity===2);
  assert.equal(flames.length,2);
  for(const flame of flames){assert.notEqual(flame.material.emissive.getHex(),0);assert.equal(flame.castShadow,false);}
  for(const part of bench.children)assert.equal(part.material.emissive.getHex(),0);
  let released=0,sharedReleased=0;
  for(const flame of flames)flame.material.addEventListener('dispose',()=>released++);
  camp.children[0].material.addEventListener('dispose',()=>sharedReleased++);
  WorldView.prototype.disposeGroup(camp);
  assert.equal(released,2);assert.equal(sharedReleased,0);
  WorldView.prototype.disposeGroup(bench);
});

test('repeated build previews release their geometry and private materials',()=>{
  const view={preview:new THREE.Group(),disposeGroup:WorldView.prototype.disposeGroup};
  for(let i=0;i<30;i++){
    WorldView.prototype.setPreview.call(view,['campfire','tent','workbench'][i%3]);
    let meshes=0,geometryReleased=0,materialsReleased=0;const uniqueMaterials=new Set();
    view.preview.traverse(o=>{if(o.isMesh){meshes++;o.geometry.addEventListener('dispose',()=>geometryReleased++);uniqueMaterials.add(o.material);}});
    for(const material of uniqueMaterials)material.addEventListener('dispose',()=>materialsReleased++);
    WorldView.prototype.setPreview.call(view,null);
    assert.ok(meshes>0);assert.equal(geometryReleased,meshes);assert.equal(materialsReleased,uniqueMaterials.size);assert.equal(view.preview.children.length,0);
  }
});

test('tent preview retains double-sided cloth and shares replacement material safely',()=>{
  const view={preview:new THREE.Group(),disposeGroup:WorldView.prototype.disposeGroup};
  WorldView.prototype.setPreview.call(view,'tent');
  const panels=[];view.preview.traverse(o=>{if(o.isMesh&&o.geometry.type==='BufferGeometry')panels.push(o);});
  assert.ok(panels.length>=5);const material=panels[0].material;
  assert.equal(material.side,THREE.DoubleSide);assert.equal(material.depthWrite,false);
  for(const panel of panels)assert.equal(panel.material,material);
  let released=0;material.addEventListener('dispose',()=>released++);
  WorldView.prototype.setPreview.call(view,null);assert.equal(released,1);
});
