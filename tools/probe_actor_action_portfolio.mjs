// Current authored bones, tool vertices and static creature cores. Diagnostic, no game save.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.min.js';
import {loadAuthorFixture} from '../tests/helpers/author-fixture.js';
import {createAuthoredCharacter,animateAuthoredCharacter,authorSolePoints} from '../src/authored-character.js';
import {createCreature,animateCreature} from '../src/creature.js';
import {actorRadius} from '../src/actor-contact.js';
import {ATTACK_DURATION,ATTACK_IMPACT,GATHER_DURATION,GATHER_IMPACT} from '../src/action-timing.js';
const output=process.argv[2]??'dist/actor-action-portfolio-2026-11-03/current.json';assert(!fs.existsSync(output));fs.mkdirSync(path.dirname(output),{recursive:true});
const markers=JSON.parse(fs.readFileSync('assets/characters/action-landmarks.json')).rows,rows=[],point=o=>o.getWorldPosition(new T.Vector3());
for(const sex of ['male','female'])for(const spec of [
 ...['hand','axe','sword'].flatMap(tool=>['crab','boar'].map(enemy=>({action:'attack',tool,enemy}))),
 ...['berry','fiber','shell'].flatMap(kind=>[1,2.7].map(distance=>({action:'gather',kind,distance,tool:'axe'})))
]){
 const {body,library}=loadAuthorFixture(sex);library.markers=markers;const actor=createAuthoredCharacter(body,library),s={x:0,z:0,yaw:0,time:10,selected:spec.tool,attackAt:-100,gatherAt:-100,gatherKind:spec.kind,gatherTarget:spec.kind?{x:0,y:.35,z:spec.distance}:null};
 animateAuthoredCharacter(actor,s,1/60);const soles=authorSolePoints(actor).map(p=>p.clone()),duration=spec.action==='attack'?ATTACK_DURATION:GATHER_DURATION,impact=spec.action==='attack'?ATTACK_IMPACT:GATHER_IMPACT;
 let creature=null,core=[];
 if(spec.enemy){creature=createCreature(spec.enemy);creature.rotation.y=Math.PI;core=creature.userData.body.children.filter(o=>o.isMesh);for(const mesh of core)for(const mat of [mesh.material].flat())mat.side=T.DoubleSide;}
 const e=spec.enemy?{type:spec.enemy,x:0,z:actorRadius({type:spec.enemy})+.35,hp:70,attackAt:-100}:null;
 const times=[...new Set([...Array.from({length:Math.ceil((duration+.1)*120)+1},(_,i)=>i/120),impact-.001,impact,impact+.001])].sort((a,b)=>a-b),samples=[];let previous=null,previousVelocity=null,maxWristSpeed=0,maxPelvisSpeed=0,maxSoleError=0,crossingFrames=0,minToolFloor=Infinity;
 for(const age of times){
  const dt=previous?age-previous.age:1/120;s.time=10+age;s[spec.action==='attack'?'attackAt':'gatherAt']=10;const before=JSON.stringify(s);animateAuthoredCharacter(actor,s,dt);assert.equal(JSON.stringify(s),before);actor.updateMatrixWorld(true);
  const wrist=point(actor.getObjectByName('hand_r')),elbow=point(actor.getObjectByName('lowerarm_r')),pelvis=point(actor.getObjectByName('pelvis')),soleError=Math.max(...authorSolePoints(actor).map((p,i)=>p.distanceTo(soles[i])));maxSoleError=Math.max(maxSoleError,soleError);
  let crossings=[];
  if(creature){animateCreature(creature,e,s.time,dt,0,s,null,()=>0);creature.updateMatrixWorld(true);const direction=wrist.clone().sub(elbow),length=direction.length(),ray=new T.Raycaster(elbow,direction.normalize(),1e-6,length-1e-6);crossings=ray.intersectObjects(core,false).map(hit=>({distance:hit.distance,remainingForearm:length-hit.distance,point:hit.point.toArray()}));if(crossings.length)crossingFrames++;}
  const blade=actor.getObjectByName(spec.tool==='axe'?'axe-head':'sword-blade');if(spec.action==='attack'&&spec.tool!=='hand'){const p=blade.geometry.attributes.position;for(let i=0;i<p.count;i++)minToolFloor=Math.min(minToolFloor,new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(blade.matrixWorld).y);}
  const sample={age,wrist:wrist.toArray(),elbow:elbow.toArray(),pelvis:pelvis.toArray(),soleError,crossings,source:actor.userData.actionSource};
  if(previous){const w=wrist.clone().sub(new T.Vector3().fromArray(previous.wrist)).divideScalar(dt),p=pelvis.clone().sub(new T.Vector3().fromArray(previous.pelvis)).divideScalar(dt);sample.wristVelocity=w.toArray();sample.pelvisVelocity=p.toArray();maxWristSpeed=Math.max(maxWristSpeed,w.length());maxPelvisSpeed=Math.max(maxPelvisSpeed,p.length());if(previousVelocity)sample.pelvisVelocityChange=p.distanceTo(previousVelocity);previousVelocity=p;}
  samples.push(sample);previous=sample;
 }
 const at=age=>samples.find(r=>Math.abs(r.age-age)<1e-10),left=at(impact),right=at(impact+.001);
 const row={sex,...spec,scope:'Flat floor; actual authored rig/wardrobe and static posed target. Forearm bone-centre segment crossing visible core triangles is not skin penetration or swept weapon collision proof. No main/input/saves/performance acceptance.',samples,maxWristSpeed,maxPelvisSpeed,maxSoleError,crossingFrames,minToolFloor:Number.isFinite(minToolFloor)?minToolFloor:null,impactPelvisVelocityJump:new T.Vector3().fromArray(left.pelvisVelocity).distanceTo(new T.Vector3().fromArray(right.pelvisVelocity)),impact:left};rows.push(row);creature?.userData.releaseSurface();
 console.log(JSON.stringify({sex,...spec,maxWristSpeed,maxPelvisSpeed,maxSoleError,crossingFrames,minToolFloor:row.minToolFloor,impactPelvisVelocityJump:row.impactPelvisVelocityJump,impactCrossings:left.crossings.length}));
}
const sources=Object.fromEntries(['src/authored-character.js','src/authored-pose-clock.js','src/creature.js','src/action-timing.js','assets/characters/action-landmarks.json'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));fs.writeFileSync(output,JSON.stringify({node:process.version,sources,rows,fullGoalComplete:false,naturalMotionAccepted:false},null,2)+'\n');
