import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createContactShade} from '../src/contact-shade.js';

const hill=(x,z)=>5+.15*x+.006*z*z;
test('contact patches share the production terrain grid and preserve depletion/recovery without reallocating',()=>{
  const world={objects:[{id:'resource-1',type:'stone',x:3,z:4,scale:1},{id:'resource-2',type:'tree',x:10,z:10,scale:1}]};
  const shade=createContactShade(world,hill),mesh=shade.resourceMesh,geometry=mesh.geometry,material=mesh.material,p=geometry.attributes.position;
  assert.ok(p.count>0);for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);assert.ok(Math.abs(x/2.5-Math.round(x/2.5))<1e-6);assert.ok(Math.abs(z/2.5-Math.round(z/2.5))<1e-6);assert.ok(Math.abs(p.getY(i)-hill(x,z)-.018)<1e-5);}
  const state={time:0,depleted:{},buildings:[]};shade.sync(state);const color=geometry.attributes.color,original=Array.from(color.array);
  state.depleted['resource-1']=10;shade.sync(state);assert.ok(color.array.some((n,i)=>i%4===3&&n===0));
  state.time=11;shade.sync(state);assert.deepEqual(Array.from(color.array),original);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);
  let released=0;material.map.addEventListener('dispose',()=>released++);shade.dispose();assert.equal(released,1);
});

test('moving feet fade with lift, omit swimmers, stay bounded and retain GPU resources',()=>{
  const shade=createContactShade({objects:[]},()=>2),foot=(x,y=2)=>new THREE.Vector3(x,y,0),player={position:new THREE.Vector3(),userData:{worldFeet:[foot(0),foot(.4,2.7)]}};
  const geometry=shade.actorMesh.geometry,material=shade.actorMesh.material;
  shade.updateActors(player,[],new Map());assert.equal(shade.actorMesh.userData.patches,1);
  player.userData.worldFeet=null;shade.updateActors(player,[],new Map());assert.equal(geometry.drawRange.count,0);
  const crowd=Array.from({length:50},(_,i)=>({model:{position:new THREE.Vector3(i/10,0,0),userData:{worldFeet:[foot(i/10),foot(i/10+.2)]}}}));
  shade.updateActors(player,crowd,new Map());assert.ok(shade.actorMesh.userData.patches<=32);assert.equal(shade.actorMesh.geometry,geometry);assert.equal(shade.actorMesh.material,material);
  assert.equal(material.depthWrite,false);assert.equal(shade.actorMesh.castShadow,false);shade.dispose();
});

test('camp footprints rebuild only when definitions change and release replaced geometry',()=>{
  const shade=createContactShade({objects:[]},()=>2),state={time:0,depleted:{},buildings:[{id:'a',type:'tent',x:1,z:2}]};shade.sync(state);
  const geometry=shade.buildingMesh.geometry;let disposed=0;geometry.addEventListener('dispose',()=>disposed++);shade.sync(state);assert.equal(shade.buildingMesh.geometry,geometry);
  state.buildings=[];shade.sync(state);assert.equal(disposed,1);assert.equal(shade.buildingMesh.geometry.attributes.position.count,0);shade.dispose();
});
