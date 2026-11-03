import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import {loadAuthorFixture} from './helpers/author-fixture.js';
import {createAuthoredCharacter,animateAuthoredCharacter,authorSolePoints} from '../src/authored-character.js';
import {ATTACK_DURATION,ATTACK_IMPACT} from '../src/action-timing.js';

for(const sex of ['male','female'])for(const tool of ['hand','axe','sword'])test(`${sex} ${tool}: contact landmark does not abruptly multiply whole-body speed`,()=>{
 const {body,library}=loadAuthorFixture(sex);library.markers=JSON.parse(fs.readFileSync(new URL('../assets/characters/action-landmarks.json',import.meta.url))).rows;
 const actor=createAuthoredCharacter(body,library),s={x:0,z:0,yaw:0,time:10,selected:tool,attackAt:-100};
 animateAuthoredCharacter(actor,s,1/60);const soles=authorSolePoints(actor).map(p=>p.clone()),h=.0001,poses=[];
 for(const age of [ATTACK_IMPACT-h,ATTACK_IMPACT,ATTACK_IMPACT+h]){
  s.attackAt=10;s.time=10+age;const before=JSON.stringify(s);animateAuthoredCharacter(actor,s,h);assert.equal(JSON.stringify(s),before);
  poses.push(['hand_r','pelvis'].map(name=>actor.getObjectByName(name).getWorldPosition(new T.Vector3())));
  for(const [i,p]of authorSolePoints(actor).entries())assert.ok(p.distanceTo(soles[i])<.003);
 }
 for(const [i,name]of ['wrist','pelvis'].entries()){
  const incoming=poses[1][i].clone().sub(poses[0][i]).divideScalar(h),outgoing=poses[2][i].clone().sub(poses[1][i]).divideScalar(h);
  assert.ok(incoming.distanceTo(outgoing)<.08*Math.max(incoming.length(),outgoing.length(),1),`${name} contact speed jumps ${incoming.distanceTo(outgoing).toFixed(3)} m/s`);
 }
 s.time=10+ATTACK_IMPACT;animateAuthoredCharacter(actor,s,h);
 assert.ok(Math.abs(actor.userData.actionSource.phase-actor.userData.actionSource.marker)<1e-10,'damage marker moved');
 const pose=actor.getObjectByName('hand_r').quaternion.toArray();animateAuthoredCharacter(actor,s,0);assert.deepEqual(actor.getObjectByName('hand_r').quaternion.toArray(),pose);
 s.time=10+ATTACK_DURATION+.001;animateAuthoredCharacter(actor,s,.3);assert.equal(actor.userData.actionSource,null);
});
