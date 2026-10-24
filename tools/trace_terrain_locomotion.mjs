// Trace the existing regression trajectory without changing production or candidate state files.
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import * as currentCharacter from '../src/character.js';
import {execFileSync} from 'node:child_process';
import {freshGame,movePlayer,tick} from '../dist/terrain-composition-candidate/tidelands-local/src/game.js';
import {terrain as candidateTerrain,createWorld} from '../dist/terrain-composition-candidate/tidelands-local/src/world.js';

const original=process.argv.includes('--original');
const originalSource=original?execFileSync('git',['show','c9f780ff20082976626849a961f9facd4e17d5b5:src/character.js'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}):null;
const character=original?await import('data:text/javascript;base64,'+Buffer.from(originalSource.replace(/from '([^']+)'/g,(_match,path)=>`from '${new URL('../src/'+path,import.meta.url).href}'`)).toString('base64')):currentCharacter;
const {createCharacter,animateCharacter}=character;
const plane=process.argv.includes('--plane-down'),terrain=plane?(_x,z)=>z*.8:candidateTerrain,result=[];
for(const fps of [30,60,144]){
  const root=createCharacter(),state=freshGame(),world=createWorld(),dt=1/fps;state.enemies=[];state.time=240;
  Object.assign(state.player,{x:plane?0:-75,z:plane?0:-235,yaw:Math.PI});root.rotation.y=Math.PI;
  function pose(){const p=state.player;root.position.set(p.x,terrain(p.x,p.z),p.z);animateCharacter(root,{...p,time:state.time,attackAt:-100,selected:'axe'},dt,terrain);root.updateMatrixWorld(true);}
  for(let i=0;i<fps;i++){tick(state,dt,false);pose();}
  const rows=[];
  for(let frame=1;frame<=fps*(plane?4:6);frame++){
    if(plane)state.player.z-=12*dt;
    else if(frame<=fps*5)movePlayer(state,world.objects,frame<=fps*2.5?0:1,frame<=fps*2.5?-1:0,dt,true);
    tick(state,dt,false);pose();const r=root.userData,p=state.player;
    rows.push({frame,time:state.time,position:[p.x,p.z],height:root.position.y,pelvis:r.body.position.y,moving:r.moving,phase:r.phase,walkBlend:r.walkBlend,
      idleStep:r.idleStep?{side:r.idleStep.side,elapsed:r.idleStep.elapsed}:null,contacts:r.footContacts,earlyLift:[...r.earlyLift],
      feet:r.worldFeet.map((foot,i)=>{const target=root.worldToLocal(foot.clone()),hip=r.hips[i].position.clone().applyQuaternion(r.body.quaternion);
        const dx=target.x-hip.x-r.body.position.x,dz=target.z-hip.z-r.body.position.z;
        return {target:target.toArray(),world:foot.toArray(),horizontal:Math.hypot(dx,dz),groundDelta:terrain(foot.x,foot.z)-root.position.y,
          heightSlope:Math.hypot(terrain(foot.x+.5,foot.z)-terrain(foot.x-.5,foot.z),terrain(foot.x,foot.z+.5)-terrain(foot.x,foot.z-.5))};})});
  }
  const worst=rows.reduce((a,b)=>b.pelvis<a.pelvis?b:a),first=rows.findIndex(r=>r.pelvis<-.6);
  result.push({fps,minimum:worst.pelvis,firstViolation:first<0?null:rows[first],firstWindow:first<0?[]:rows.slice(Math.max(0,first-2),first+3),worst});
}
const files=['src/character.js','dist/terrain-composition-candidate/tidelands-local/src/world.js'];
  const report={original,characterSource:original?'git:c9f780ff20082976626849a961f9facd4e17d5b5:src/character.js':'src/character.js',planeDown:plane,scope:'30/60/144fps fallback regression trajectory on full-amplitude coherent candidate OR continuous -Z 0.8 planar slope. Diagnostic only; no production integration, quality or browser acceptance.',
  sources:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(p==='src/character.js'&&original?originalSource:readFileSync(new URL('../'+p,import.meta.url))).digest('hex')])),rows:result};
writeFileSync(new URL('../docs/'+(original?'terrain-support-original-plane-trace.json':plane?'terrain-support-plane-trace.json':'terrain-locomotion-trace.json'),import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(result.map(r=>({fps:r.fps,minimum:r.minimum,first:r.firstViolation?.frame,worst:{frame:r.worst.frame,moving:r.worst.moving,idleStep:r.worst.idleStep,contacts:r.worst.contacts,earlyLift:r.worst.earlyLift,feet:r.worst.feet.map(f=>({horizontal:f.horizontal,groundDelta:f.groundDelta}))}}))));
