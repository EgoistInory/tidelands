// Numerical pose/rule audit only: flat fixture, not rendered contact or gameplay acceptance.
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import {freshGame,attack,resolveAttack} from '../src/game.js';
import {ATTACK_DURATION,ATTACK_IMPACT,GATHER_IMPACT} from '../src/action-timing.js';

const samples=[];
for(const selected of ['axe','sword']){
  const root=createCharacter(),blade=root.getObjectByName(selected==='axe'?'axe-head':'sword-blade');
  let maxHorizontalReach=0;
  for(let frame=0;frame<=90;frame++){
    const time=frame*ATTACK_DURATION/90;
    animateCharacter(root,{x:0,z:0,yaw:0,time,attackAt:0,selected},1/200,()=>0);root.updateMatrixWorld(true);
    const point=new THREE.Vector3(),position=blade.geometry.attributes.position;
    for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(blade.matrixWorld);maxHorizontalReach=Math.max(maxHorizontalReach,Math.hypot(point.x,point.z));}
  }
  for(const [action,time] of [['attack',ATTACK_IMPACT],['gather',GATHER_IMPACT]]){
    animateCharacter(root,{x:0,z:0,yaw:0,time,attackAt:action==='attack'?0:-100,gatherAt:action==='gather'?0:-100,selected},1/60,()=>0);root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(blade);
    samples.push({selected,action,time,bladeBounds:{min:box.min.toArray(),max:box.max.toArray()},maximumHorizontalAttackReach:maxHorizontalReach});
  }
  root.traverse(o=>{if(o.geometry)o.geometry.dispose();});
}
const rules=[];
for(const [x,z] of [[0,2.5],[0,5.1],[0,-5.1],[5.1,0]]){
  const state=freshGame();Object.assign(state.player,{x:0,z:0,yaw:0});state.time=0;state.selected='sword';state.inventory.sword=1;
  state.enemies=[{id:'contact-fixture',type:'crab',x,z,hp:40}];
  const pending=attack(state,{defer:true}).pending;state.time=ATTACK_IMPACT;const result=resolveAttack(state,pending);
  rules.push({targetXZ:[x,z],distance:Math.hypot(x,z),hits:result.hits,remainingHp:state.enemies[0].hp});
}
const files=['src/character.js','src/game.js','src/action-timing.js'];
const report={kind:'numerical-attack-contact-review',scope:'Stationary flat-ground mesh-vertex bounds and isolated rule fixtures. No real creature hull/triangle collision, rendered UI, weapon sweep collision or normal campaign acceptance.',fullGoalComplete:false,samples,rules,sourceSha256:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(new URL('../'+f,import.meta.url))).digest('hex')]))};
writeFileSync(new URL('../docs/attack-contact-numerical.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:samples.length,rules:rules.length,reach:samples.filter(s=>s.action==='attack').map(s=>({selected:s.selected,maximumHorizontalReach:s.maximumHorizontalAttackReach,impactHeight:s.bladeBounds})),hits:rules.map(r=>({xz:r.targetXZ,hits:r.hits.length}))}));
