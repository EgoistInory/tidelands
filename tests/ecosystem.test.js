import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {createTree} from '../src/tree.js';
import {createCanopy} from '../src/foliage.js';
import {createWorld,terrain,layoutTerrain,LANDMARKS,SPAWN} from '../src/world.js';
import {islandTreeAppearance} from '../src/landscape.js';
import {WorldView} from '../src/scene.js';
import {freshGame,interact,serialize,restore} from '../src/game.js';
import {unobstructedCamera} from '../src/camera.js';

const forms=['coast','forest','highland','shoal'];
const grove=o=>o.id.startsWith('resource-')&&Number(o.id.slice(9))>=1800;
test('four regional tree forms have distinct geometry with rooted trunks and open walking space',()=>{
  const signatures=[];
  for(const form of forms){
    const a=createTree(form),b=createTree(form),trunk=a.getObjectByName('tree-trunk');
    signatures.push(createHash('sha256').update(a.children.map(m=>Array.from(m.geometry.attributes.position.array)).join(',')).digest('hex'));
    a.children.forEach((m,i)=>{assert.deepEqual(m.geometry.attributes.position.array,b.children[i].geometry.attributes.position.array);assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));});
    const p=trunk.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)<.1)assert.ok(Math.hypot(p.getX(i),p.getZ(i))<.65);
    for(const branch of a.children.filter(m=>m.name==='tree-branch'))assert.ok(new THREE.Box3().setFromObject(branch).min.y>3);
  }
  assert.equal(new Set(signatures).size,4,'height/tint alone is not a regional silhouette');
});

test('leaf mip chains retain a visible subpixel crown and share the exact shadow map',()=>{
  const canopy=createCanopy(),map=canopy.material.map;
  assert.equal(map.generateMipmaps,false);assert.equal(map.mipmaps.length,8);
  map.mipmaps.forEach((m,i)=>{assert.equal(m.width,128/2**i);assert.equal(m.height,m.width);assert.equal(m.data.length,m.width*m.height*4);});
  assert.ok(map.mipmaps.at(-1).data[3]>=128,'far foliage must not disappear behind the alpha cutoff');
  assert.equal(canopy.customDepthMaterial.map,map);
});

test('grove resources preserve every existing node and enemy and keep landmark approaches open',()=>{
  const world=createWorld(),original={objects:world.objects.filter(o=>!grove(o)).map(o=>({...o,y:layoutTerrain(o.x,o.z)})),enemies:world.enemies};
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),'2099862062ee73f7175d2567899b306f975053e0546ee2b6cc0714b3e518462b');
  const extra=world.objects.filter(grove);assert.ok(extra.length>=80&&extra.length<=140);
  const regions=new Set();
  for(const node of extra){
    assert.equal(node.type,'tree');assert.equal(node.y,terrain(node.x,node.z));regions.add(islandTreeAppearance(node).form);
    assert.ok(Math.hypot(node.x-SPAWN.x,node.z-SPAWN.z)>12);
    assert.ok(LANDMARKS.every(o=>Math.hypot(node.x-o.x,node.z-o.z)>14));
    assert.ok(world.objects.every(o=>o===node||!['tree','stone','crystal'].includes(o.type)||Math.hypot(node.x-o.x,node.z-o.z)>3.4));
  }
  assert.equal(regions.size,4);assert.equal(new Set(world.objects.map(o=>o.id)).size,world.objects.length);
});

test('regional instance batches use their own bounds, and new grove nodes gather and survive save restore',()=>{
  const world=createWorld(),view={world,scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};WorldView.prototype.createScenery.call(view);
  const batches=view.batches.filter(b=>b.entries[0]?.type==='tree');assert.equal(batches.length,8);
  assert.equal(new Set(batches.map(b=>b.batch.userData.treeForm)).size,4);
  for(const b of batches){assert.ok(b.entries.every(o=>islandTreeAppearance(o).form===b.batch.userData.treeForm));const matrix=new THREE.Matrix4();for(let i=0;i<b.entries.length;i++){b.batch.getMatrixAt(i,matrix);assert.ok(matrix.elements[5]>=.94999,'small trees retain head clearance');}}
  const node=world.objects.find(grove);assert.ok(view.cameraObstacles.find(e=>e.object===node)?.boxes.length>1);
  const state=freshGame();Object.assign(state.player,{x:node.x-2,z:node.z});const before=state.inventory.wood;interact(state,node);
  assert.ok(state.inventory.wood>before);assert.ok(state.depleted[node.id]>state.time);
  const restored=restore(serialize(state));assert.equal(restored.depleted[node.id],state.depleted[node.id]);assert.equal(restored.inventory.wood,state.inventory.wood);
});

test('the exposed shoal grove keeps subject distance by finding clear space below the crown',()=>{
  const world=createWorld(),view={world,scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};WorldView.prototype.createScenery.call(view);
  const focus=new THREE.Vector3(107,terrain(107,193)+2.4,193),desired=new THREE.Vector3(107+Math.sin(.15)*17,focus.y+Math.tan(.31)*17,193+Math.cos(.15)*17),original=desired.clone();
  const boxes=view.cameraObstacles.filter(e=>Math.hypot(e.object.x-107,e.object.z-193)<29).flatMap(e=>e.boxes??[e.box]);
  const safe=unobstructedCamera(focus,desired,boxes,terrain,6,.15);assert.ok(safe.distanceTo(focus)>=6,'dense crowns must not collapse the view to1.96m');assert.ok(desired.equals(original));
  const ray=new THREE.Ray(focus,safe.clone().sub(focus).normalize());
  for(const box of boxes){if(box.containsPoint(focus))continue;const hit=ray.intersectBox(box,new THREE.Vector3());assert.ok(!hit||hit.distanceTo(focus)>safe.distanceTo(focus));}
  assert.ok(safe.y>=terrain(safe.x,safe.z)+.4);
});


test('low shoal crowns leave a six metre ray at the exposed moving corner',()=>{
  const view={world:createWorld(),scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};WorldView.prototype.createScenery.call(view);
  const x=138.9164481317843,z=175.4729233313293,focus=new THREE.Vector3(x,terrain(x,z)+2.4,z),yaw=2.54;
  const desired=new THREE.Vector3(x+Math.sin(yaw)*14,focus.y+Math.tan(.29)*14,z+Math.cos(yaw)*14);desired.y=Math.max(desired.y,terrain(desired.x,desired.z)+1.5);
  const boxes=view.cameraObstacles.filter(e=>Math.hypot(e.object.x-x,e.object.z-z)<26).flatMap(e=>e.boxes??[e.box]);
  const safe=unobstructedCamera(focus,desired,boxes,terrain,6,2.25);
  assert.ok(safe.distanceTo(focus)>=6,'the low crown traps the moving camera at3.46m');
});
