// Reproduce the declared close-contact poses with production geometry/IK; no saved gameplay.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {createCreature,animateCreature} from '../src/creature.js';
import {freshGame,tick,attack,resolveAttack,enemyAttackPose} from '../src/game.js';
import {terrain} from '../src/world.js';import {actorRadius} from '../src/actor-contact.js';
import {ATTACK_IMPACT,ENEMY_ATTACK_IMPACT} from '../src/action-timing.js';
const output=process.argv[2]??'dist/close-encounter-review-2026-11-03/support.json';if(fs.existsSync(output))throw Error('Preserve the existing evidence; choose a new output');
const rows=[];
for(const type of ['crab','boar'])for(const phase of ['idle','enemy','player']){
 const state=freshGame();state.time=240;state.inventory.axe=1;state.selected=phase==='player'?'axe':'hand';Object.assign(state.player,{x:14.3,z:41.4,yaw:0});
 const d=actorRadius({type})+actorRadius(state.player),enemy={id:'close-review',type,x:14.3,z:41.4+d,hp:type==='boar'?70:40,attackAt:0};state.enemies=[enemy];
 const root=createCreature(type),draw=()=>animateCreature(root,enemy,state.time,1/60,terrain(enemy.x,enemy.z),state.player,enemyAttackPose(state,enemy),terrain);
 for(let i=0;i<60;i++)draw();
 if(phase==='enemy'){tick(state,.00001,false,null,[]);tick(state,ENEMY_ATTACK_IMPACT,false,null,[]);}
 if(phase==='player'){const pending=attack(state,{defer:true}).pending;state.time+=ATTACK_IMPACT;resolveAttack(state,pending);}
 for(let i=0;i<30;i++)draw();root.updateMatrixWorld(true);
 const feet=root.userData.contacts.map((c,i)=>{
  const foot=c.point.clone().applyMatrix4(c.leg.matrixWorld),gap=foot.y-terrain(foot.x,foot.z);let soleMin=null;
  if(c.ankle){soleMin=Infinity;c.ankle.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let j=0;j<p.count;j++){const v=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld);soleMin=Math.min(soleMin,v.y-terrain(v.x,v.z));}});}
  return {i,point:foot.toArray(),gap,declaredPlanted:root.userData.footContacts[i],visibleHoofMinGap:soleMin};
 });rows.push({type,phase,time:state.time,root:[enemy.x,terrain(enemy.x,enemy.z),enemy.z],groundLift:root.userData.ground.position.y,feet,minGap:Math.min(...feet.map(f=>f.gap)),maxGap:Math.max(...feet.map(f=>f.gap)),declaredPlanted:feet.filter(f=>f.declaredPlanted).length});
}
const report={scope:'Six exact-contact coast fixtures matching the review page;60 idle warm/30 frozen-pose solves. Foot proxies and boar visible hoof vertices; not native gameplay, whole-scene performance, complete sole or triangle contact acceptance.',sources:Object.fromEntries(['src/creature.js','src/creature-footing.js','src/world.js','src/game.js'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),node:process.version,rows};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(rows.map(({feet,...r})=>({...r,hoofMinGaps:feet.map(f=>f.visibleHoofMinGap)}))));
