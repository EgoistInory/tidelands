import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createAuthoredCharacter,animateAuthoredCharacter,authorSolePoints} from '../src/authored-character.js';
import {loadAuthorFixture} from './helpers/author-fixture.js';

test('actual author rig follows game location, carries selected tools and stays finite across movement and water',()=>{
 const {body,library}=loadAuthorFixture('male'),actor=createAuthoredCharacter(body,library,'traveler');
 const s={x:0,z:0,yaw:0,time:0,selected:'axe',attackAt:-100,gatherAt:-100};
 for(let i=0;i<180;i++){s.time=i/60;s.z=i*7/60;animateAuthoredCharacter(actor,s,1/60,()=>0);actor.updateMatrixWorld(true);assert.equal(actor.position.z,s.z);assert.ok(actor.userData.worldFeet.every(p=>p.toArray().every(Number.isFinite)));}
 assert.equal(actor.userData.axe.visible,true);assert.equal(actor.userData.sword.visible,false);assert.ok(actor.userData.footfallCount>0);
 s.selected='sword';s.swimming=true;s.time+=1;animateAuthoredCharacter(actor,s,1/60,()=>-3);actor.updateMatrixWorld(true);assert.deepEqual(actor.userData.worldFeet,[]);assert.equal(actor.userData.sword.visible,true);
 const chest=actor.getObjectByName('spine_03').getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(chest.y-.12)<.05);
 assert.equal(actor.userData.authored,true);
});
test('actual source rest proportions survive, and planted world supports stay fixed during complete tool actions',()=>{
 for(const fps of [30,60,144]){
  const {body,library}=loadAuthorFixture('female'),actor=createAuthoredCharacter(body,library,'botanist'),ground=(x,z)=>.04*x+.08*z;
  const s={x:2,z:3,yaw:0,time:10,selected:'sword',attackAt:-100,gatherAt:-100};animateAuthoredCharacter(actor,s,1/fps,ground);const initial=actor.userData.worldFeet.map(p=>p.clone());
  for(let frame=0;frame<=fps;frame++){s.time=10+frame/fps;s.attackAt=10;animateAuthoredCharacter(actor,s,1/fps,ground);actor.updateMatrixWorld(true);for(let j=0;j<2;j++){assert.ok(actor.userData.worldFeet[j].distanceTo(initial[j])<1e-6);assert.ok(authorSolePoints(actor)[j].distanceTo(actor.userData.worldFeet[j])<.003, `actual sole error ${authorSolePoints(actor)[j].distanceTo(actor.userData.worldFeet[j])}`);}}
  assert.equal(actor.userData.axe.visible,false);assert.equal(actor.userData.sword.visible,true);
 }
});
test('moving actual sole anchors track support targets through production speeds, slopes and turns',()=>{
 for(const fps of [30,60,144])for(const speed of [7,12]){
  const {body,library}=loadAuthorFixture(),actor=createAuthoredCharacter(body,library),ground=(x,z)=>.06*x+.12*z,s={x:0,z:0,yaw:0,time:0,selected:'hand',attackAt:-100};animateAuthoredCharacter(actor,s,1/fps,ground);let contacts=0;
  for(let i=1;i<=fps*2;i++){s.time=i/fps;s.yaw=Math.min(Math.PI/2,i/fps);s.x+=Math.sin(s.yaw)*speed/fps;s.z+=Math.cos(s.yaw)*speed/fps;animateAuthoredCharacter(actor,s,1/fps,ground);const soles=authorSolePoints(actor);for(let j=0;j<2;j++)if(actor.userData.legs[j].contact){contacts++;const error=soles[j].distanceTo(actor.userData.worldFeet[j]);assert.ok(error<.03,`${fps}/${speed} actual planted sole error ${error}`);}}
  assert.ok(contacts>fps*.1);
 }
});
test('cloned actual rig owns its bones while sharing immutable template buffers',async()=>{
 const {cloneAuthoredRig}=await import('../src/authored-assets.js'),{body}=loadAuthorFixture(),copy=cloneAuthoredRig(body);const source=body.getObjectByName('Head'),head=copy.getObjectByName('Head');assert.notEqual(head,source);head.rotation.y=.7;assert.notEqual(source.rotation.y,head.rotation.y);
 let a,b;body.traverse(o=>{if(o.isSkinnedMesh)a=o;});copy.traverse(o=>{if(o.isSkinnedMesh)b=o;});assert.equal(a.geometry,b.geometry);assert.notEqual(a.skeleton,b.skeleton);assert.equal(b.skeleton.bones.find(o=>o.name==='Head'),head);
});
test('paused actual skeleton and support contacts do not snap into an idle gait',()=>{
 const {body,library}=loadAuthorFixture(),actor=createAuthoredCharacter(body,library),s={x:0,z:0,yaw:0,time:0,selected:'hand',attackAt:-100};animateAuthoredCharacter(actor,s,1/60,()=>0);
 for(let i=1;i<=20;i++){s.z=i*7/60;s.time=i/60;animateAuthoredCharacter(actor,s,1/60,()=>0);}const before=authorSolePoints(actor).map(p=>p.toArray()),plan=structuredClone(actor.userData.plan);
 for(let i=0;i<10;i++)animateAuthoredCharacter(actor,s,0,()=>0);assert.deepEqual(authorSolePoints(actor).map(p=>p.toArray()),before);assert.deepEqual(actor.userData.plan,plan);
});
test('shallow-water visuals wade on the actual floor while deep water uses the real waterline',()=>{
 const {body,library}=loadAuthorFixture(),actor=createAuthoredCharacter(body,library),s={x:0,z:0,yaw:0,time:0,selected:'hand',attackAt:-100,swimming:true};animateAuthoredCharacter(actor,s,1/60,()=>-.4);assert.equal(actor.userData.worldFeet.length,2);assert.equal(actor.userData.plan.baseClip,'Idle_Loop');for(const p of authorSolePoints(actor))assert.ok(Math.abs(p.y+.4)<.003);assert.equal(s.swimming,true);
});
test('existing world-sized tools do not get enlarged a second time by author body normalization',()=>{
 const {body,library}=loadAuthorFixture(),actor=createAuthoredCharacter(body,library);actor.updateMatrixWorld(true);const scale=actor.userData.sword.getWorldScale(new THREE.Vector3());for(const value of scale.toArray())assert.ok(Math.abs(value-1)<.00001);
});
test('restored facing initializes before planting and stationary turns recover each foot',()=>{
 const {body,library}=loadAuthorFixture(),actor=createAuthoredCharacter(body,library),s={x:0,z:0,yaw:Math.PI,time:0,selected:'hand',attackAt:-100};animateAuthoredCharacter(actor,s,1/60,()=>0);assert.ok(Math.abs(actor.rotation.y-Math.PI)<1e-8);
 for(let i=1;i<=120;i++){s.time=i/60;s.yaw=Math.PI+i/120*Math.PI;animateAuthoredCharacter(actor,s,1/60,()=>0);for(const [j,p]of authorSolePoints(actor).entries())if(actor.userData.legs[j].contact)assert.ok(p.distanceTo(actor.userData.worldFeet[j])<.003);}
 assert.ok(actor.userData.footfallCount>0);assert.ok(actor.userData.worldFeet.every(p=>Math.abs(p.y)<.13));
});
