import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCreature,animateCreature,resetCreature} from '../src/creature.js';

for(const type of ['boar','crab'])test(`${type}: resting foot surfaces follow a sloped plane at multiple headings`,()=>{
  const floor=(x,z)=>4+.25*x-.18*z;
  for(const yaw of [0,1.1,-2]){
    const model=createCreature(type),e={x:10,z:7,hp:70,attackAt:-100};model.rotation.y=yaw;
    const feet=model.userData.legs.map(leg=>{const points=[];leg.traverse(mesh=>{if(!mesh.isMesh)return;mesh.updateMatrix();const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrix));});const low=Math.min(...points.map(p=>p.y));return {leg,points:points.filter(p=>p.y<=low+.025)};});
    for(let i=0;i<60;i++)animateCreature(model,e,10+i/60,1/60,floor(e.x,e.z),{x:100,z:100},null,floor);
    model.updateMatrixWorld(true);
    for(const {leg,points}of feet){const gaps=points.map(p=>{const point=p.clone().applyMatrix4(leg.matrixWorld);return point.y-floor(point.x,point.z);});assert.ok(Math.min(...gaps)>-.04,`${type} foot penetrates the slope`);assert.ok(Math.min(...gaps)<.09,`${type} foot floats above the slope`);}
    assert.ok(Math.abs(model.rotation.y-yaw)<1e-10,'ground fitting must preserve facing');
    resetCreature(model);assert.equal(model.position.y,0);
  }
});
