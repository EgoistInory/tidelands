import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {updateCampClearance} from '../src/meadow.js';
import {WorldView} from '../src/scene.js';

function batch(points,name='meadow-grass'){
  const geometry=new THREE.BoxGeometry(.4,.6,.4);geometry.computeBoundingBox();
  const b=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial(),points.length);b.name=name;
  for(let i=0;i<points.length;i++)b.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(points[i][0],.2,points[i][1]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.3),new THREE.Vector3(1.3,1.1,1.3)));
  b.computeBoundingBox();b.computeBoundingSphere();return b;
}
const matrices=b=>[...b.instanceMatrix.array];
const determinant=(b,i)=>{const m=new THREE.Matrix4();b.getMatrixAt(i,m);return m.determinant();};
const hidden=(b,i)=>b.instanceMatrix.array[i*16+13]<-1000;

test('camp hides only overlapping landscape instances and restores exact transforms after moving or removal',()=>{
  const b=batch([[0,0],[2.4,0],[7,0]]),resource=batch([[0,0]],'fiber-resource'),original=matrices(b),bounds=b.boundingBox.clone(),sphere=b.boundingSphere.clone();
  const buildings=[{id:'a',type:'tent',x:0,z:0}],before=JSON.stringify(buildings);
  assert.equal(updateCampClearance([b,resource],buildings),2);assert.ok(hidden(b,0)&&hidden(b,1)&&!hidden(b,2));
  assert.ok([0,1,2].every(i=>determinant(b,i)>0),'hidden wind bases remain finite and nonsingular');
  assert.ok(determinant(resource,0)>0);assert.equal(JSON.stringify(buildings),before);assert.deepEqual(b.boundingBox,bounds);assert.deepEqual(b.boundingSphere,sphere);
  const version=b.instanceMatrix.version;assert.equal(updateCampClearance([b,resource],buildings),0);assert.equal(b.instanceMatrix.version,version);
  buildings[0].x=7;assert.equal(updateCampClearance([b],buildings),3);assert.ok(!hidden(b,0)&&!hidden(b,1)&&hidden(b,2));
  assert.equal(updateCampClearance([b],[]),1);assert.deepEqual(matrices(b),original);assert.equal(b.userData.campHidden.size,0);
});
test('overlapping camps, type replacements and the 500th building have no fixed shader-slot limit',()=>{
  const b=batch([[0,0],[2.4,0],[8,0]]),original=matrices(b);
  updateCampClearance([b],[{type:'tent',x:0,z:0},{type:'tent',x:.2,z:0}]);assert.ok(hidden(b,1));
  updateCampClearance([b],[{type:'campfire',x:0,z:0}]);assert.ok(!hidden(b,1)&&hidden(b,0));
  const camps=Array.from({length:499},(_,i)=>({id:String(i),type:'workbench',x:350+(i%10)*2,z:350+Math.floor(i/10)*.5}));camps.push({id:'tail',type:'tent',x:8,z:0});
  updateCampClearance([b],camps);assert.ok(!hidden(b,0)&&hidden(b,2));
  updateCampClearance([b],[]);assert.deepEqual(matrices(b),original);
});
test('production sync applies and restores clearance during same-ID camp relocation and save replacement',()=>{
  const b=batch([[0,0],[8,0]]),view={batches:[],meadow:[b],buildings:new Map(),creatures:new Map(),scene:new THREE.Scene(),disposeGroup:WorldView.prototype.disposeGroup};
  const state={buildings:[{id:'same',type:'tent',x:0,z:0}],enemies:[]};
  WorldView.prototype.sync.call(view,state);assert.ok(hidden(b,0)&&!hidden(b,1));
  state.buildings[0].x=8;WorldView.prototype.sync.call(view,state);assert.ok(!hidden(b,0)&&hidden(b,1));
  WorldView.prototype.sync.call(view,{buildings:[],enemies:[]});assert.ok(!hidden(b,0)&&!hidden(b,1));
});

test('removing a camp uploads only changed near buffers and keeps distant buffers untouched',()=>{
  const near=batch([[0,0]]),far=batch([[100,100]]),version=far.instanceMatrix.version;
  updateCampClearance([near,far],[{type:'tent',x:0,z:0}]);assert.equal(far.instanceMatrix.version,version);
  updateCampClearance([near,far],[]);assert.equal(far.instanceMatrix.version,version);
  assert.equal(far.userData.campHidden.size,0);assert.equal(near.userData.campHidden.size,0);
});
