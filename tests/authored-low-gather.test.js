import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {createAuthoredCharacter,animateAuthoredCharacter,authorSolePoints} from '../src/authored-character.js';
import {loadAuthorFixture} from './helpers/author-fixture.js';
for(const sex of ['male','female'])for(const kind of ['berry','fiber','shell'])test(`${sex} ${kind}: whole-body pickup lowers the pelvis, reaches a nearby target and retains world supports`,()=>{
 const {body,library}=loadAuthorFixture(sex),actor=createAuthoredCharacter(body,library),ground=(x,z)=>.03*x+.06*z;
 const state={x:0,z:0,yaw:0,time:10,selected:'axe',attackAt:-100,gatherAt:-100,gatherKind:kind,gatherTarget:{x:0,z:1,y:.41}};
 animateAuthoredCharacter(actor,state,1/60,ground);const before=actor.getObjectByName('pelvis').getWorldPosition(new T.Vector3()),supports=authorSolePoints(actor).map(p=>p.clone());state.gatherAt=10;
 const snapshot=JSON.stringify(state);let atImpact;
 for(let i=1;i<=42;i++){state.time=10+i*.01;animateAuthoredCharacter(actor,state,.01,ground);for(const [j,p]of authorSolePoints(actor).entries())assert.ok(p.distanceTo(supports[j])<.003,'planted sole displaced');if(i===21)atImpact={pelvis:actor.getObjectByName('pelvis').getWorldPosition(new T.Vector3()),hand:actor.getObjectByName('hand_r').getWorldPosition(new T.Vector3()),toolVisible:actor.userData.axe.visible};}
 assert.ok(before.y-atImpact.pelvis.y>.5,'whole-body pelvis never lowered');assert.ok(atImpact.hand.distanceTo(new T.Vector3(0,.41,1))<.04,`actual wrist misses target: ${atImpact.hand.toArray()}`);
 assert.equal(atImpact.toolVisible,false);assert.equal(state.x,0);assert.equal(state.z,0);assert.equal(JSON.stringify({...state,time:10}),snapshot);
 state.time=11;state.gatherAt=-100;animateAuthoredCharacter(actor,state,1/60,ground);assert.equal(actor.userData.actionSource,null);assert.ok(actor.getObjectByName('pelvis').getWorldPosition(new T.Vector3()).y>1.35);
});
test('unreachable target preserves arm length and paused action; a cancelled action clears the reach',()=>{
 const {body,library}=loadAuthorFixture(),actor=createAuthoredCharacter(body,library),s={x:0,z:0,yaw:0,time:10,selected:'hand',attackAt:-100,gatherAt:-100,gatherKind:'fiber',gatherTarget:{x:0,y:.35,z:2.9}};
 animateAuthoredCharacter(actor,s,1/60);const initialArm=['upperarm_r','lowerarm_r','hand_r'].map(n=>actor.getObjectByName(n).getWorldPosition(new T.Vector3())),originalLengths=[initialArm[0].distanceTo(initialArm[1]),initialArm[1].distanceTo(initialArm[2])];s.gatherAt=10;s.time=10.21;animateAuthoredCharacter(actor,s,.21);const points=['upperarm_r','lowerarm_r','hand_r'].map(n=>actor.getObjectByName(n).getWorldPosition(new T.Vector3())),length=points[0].distanceTo(points[1])+points[1].distanceTo(points[2]);assert.ok(points[0].distanceTo(points[2])<=length+.0001);assert.ok(Math.abs(points[0].distanceTo(points[1])-originalLengths[0])<.00001);assert.ok(Math.abs(points[1].distanceTo(points[2])-originalLengths[1])<.00001);assert.ok(points[2].distanceTo(new T.Vector3(0,.35,2.9))>.5,'unreachable node must not stretch bones');
 const pose=points.map(p=>p.toArray());animateAuthoredCharacter(actor,s,0);assert.deepEqual(['upperarm_r','lowerarm_r','hand_r'].map(n=>actor.getObjectByName(n).getWorldPosition(new T.Vector3()).toArray()),pose);
 s.time+=.01;s.gatherAt=-100;s.gatherTarget=null;animateAuthoredCharacter(actor,s,.01);assert.equal(actor.userData.actionSource,null);assert.ok(actor.getObjectByName('pelvis').getWorldPosition(new T.Vector3()).y>1.35);
});
test('changing the production state identity clears the transient reach target while ordinary sync preserves it',async()=>{
 const {WorldView}=await import('../src/scene.js'),view={batches:[],buildings:new Map(),creatures:new Map(),scene:new T.Scene()},state={buildings:[],enemies:[]};
 WorldView.prototype.sync.call(view,state);view.gatherTarget={x:1,y:.35,z:2};view.gatherAt=10;WorldView.prototype.sync.call(view,state);assert.deepEqual(view.gatherTarget,{x:1,y:.35,z:2});WorldView.prototype.sync.call(view,{buildings:[],enemies:[]});assert.equal(view.gatherTarget,null);assert.equal(view.gatherAt,-100);
});
test('moving low pickup and water interruption keep finite skeletons without changing authoritative movement',()=>{
 const {body,library}=loadAuthorFixture(),actor=createAuthoredCharacter(body,library),s={x:0,z:0,yaw:0,time:10,selected:'axe',attackAt:-100,gatherAt:-100,gatherKind:'shell',gatherTarget:{x:0,y:.35,z:1}};animateAuthoredCharacter(actor,s,1/60);s.gatherAt=10;
 for(let i=1;i<=24;i++){s.time=10+i/60;s.x=i*7/60;const before=JSON.stringify(s);animateAuthoredCharacter(actor,s,1/60,(x,z)=>.03*x+.02*z);assert.equal(JSON.stringify(s),before);for(const name of ['pelvis','hand_r','foot_l','foot_r'])assert.ok(actor.getObjectByName(name).matrixWorld.elements.every(Number.isFinite));}
 s.time+=1/60;s.swimming=true;animateAuthoredCharacter(actor,s,1/60,()=>-3);assert.equal(actor.userData.actionSource,null);assert.deepEqual(actor.userData.worldFeet,[]);
});
