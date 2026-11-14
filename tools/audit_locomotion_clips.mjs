// Actual local author rig, full-body trajectory diagnostic. Not a visual acceptance.
import fs from 'node:fs';import assert from 'node:assert/strict';import * as T from '../vendor/three.module.min.js';
import {loadAuthorFixture} from '../tests/helpers/author-fixture.js';
import {createAuthoredCharacter,animateAuthoredCharacter,authorSolePoints} from '../src/authored-character.js';
import {AUTHORED_STRIDES} from '../src/authored-pose-clock.js';
const out=process.argv[2]??'dist/locomotion-clip-audit-2026-11-15.json';assert(!fs.existsSync(out));
const metadata=loadAuthorFixture().library;
const report={sourceAnimationNames:metadata.animations.filter(c=>/Walk|Jog|Sprint/.test(c.name)).map(c=>({name:c.name,duration:c.duration,rootPositions:c.tracks.filter(t=>/root/i.test(t.name)&&t.name.endsWith('.position')).map(t=>({name:t.name,start:[...t.values.slice(0,3)],end:[...t.values.slice(-3)]}))})),cases:[],scope:'Actual shipped local skeleton and clips. Controlled flat-floor trajectories compare current grounding with retargeted source poses before the grounding overlay. No ordinary inputs or motion/naturalness acceptance.'};
for(const [speed,name]of [[2.4,'Walk_Loop'],[7,'Jog_Fwd_Loop'],[12,'Sprint_Loop']])for(const variant of ['current','source']){
 const {body,library}=loadAuthorFixture(),actor=createAuthoredCharacter(body,library),rig=actor.userData,clip=rig.clips.get(name),s={x:0,z:0,yaw:0,time:0,selected:'hand',attackAt:-100};
 let maxSpan=0,maxLegAngle=0,minPelvis=Infinity,maxPelvis=-Infinity;
 animateAuthoredCharacter(actor,s,1/60,()=>0);
 for(let i=1;i<=240;i++){
  s.time=i/60;s.z=s.time*speed;
  if(variant==='current')animateAuthoredCharacter(actor,s,1/60,()=>0);
  else{actor.position.set(0,0,s.z);const phase=(s.z/(AUTHORED_STRIDES[name]*rig.scale))%1;
   for(const t of clip.tracks){const v=t.sample.evaluate(phase*clip.duration);t.bone[t.property].fromArray(v);}
   actor.updateMatrixWorld(true);
  }
  const soles=authorSolePoints(actor);maxSpan=Math.max(maxSpan,soles[0].distanceTo(soles[1]));
  const pelvis=actor.getObjectByName('pelvis').getWorldPosition(new T.Vector3()).y;minPelvis=Math.min(minPelvis,pelvis);maxPelvis=Math.max(maxPelvis,pelvis);
  for(const leg of rig.legs){const h=leg.hip.getWorldPosition(new T.Vector3()),a=leg.foot.getWorldPosition(new T.Vector3()),v=a.sub(h).normalize();maxLegAngle=Math.max(maxLegAngle,Math.acos(T.MathUtils.clamp(-v.y,-1,1))*180/Math.PI);}
 }
 const contactTravel=[];let prior=null;
 actor.position.set(0,0,0);rig.body.position.set(0,0,0);rig.body.rotation.set(0,0,0);actor.rotation.set(0,0,0);
 for(let frame=0;frame<=240;frame++){
  for(const t of clip.tracks)t.bone[t.property].fromArray(t.sample.evaluate(frame/240*clip.duration));actor.updateMatrixWorld(true);
  const points=authorSolePoints(actor);
  for(let j=0;j<2;j++)if(prior&&points[j].y-rig.floors[name][j]<.035*rig.scale&&prior[j].y-rig.floors[name][j]<.035*rig.scale){const travel=-(points[j].z-prior[j].z)*240;if(travel>0)contactTravel.push(travel);}
  prior=points;
 }
 contactTravel.sort((a,b)=>a-b);
 const rm=library.animations.find(c=>c.name===name.replace('_Loop','_RM'));
 report.cases.push({speed,name,variant,scale:rig.scale,libraryHeight:library.height,sourceDuration:clip.duration,cycleSeconds:AUTHORED_STRIDES[name]*rig.scale/speed,contactTravelSamples:contactTravel.length,medianContactStride:contactTravel[Math.floor(contactTravel.length*.5)],footfalls:rig.footfallCount,estimatedDistancePerFootfall:variant==='current'?speed*4/rig.footfallCount:null,maxFootSpan:maxSpan,spanToBodyHeight:maxSpan/2.95,maxLegAngle,minPelvis,maxPelvis,rootMotion:rm?.tracks.filter(t=>t.name==='root.position').map(t=>({start:[...t.values.slice(0,3)],end:[...t.values.slice(-3)]}))});
}
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
