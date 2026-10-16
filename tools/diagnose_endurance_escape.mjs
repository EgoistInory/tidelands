import fs from 'node:fs';
import {createWorld} from '../src/world.js';
import {freshGame,movePlayer,tick,nearestEnemy,attack,resolveAttack,eat} from '../src/game.js';
import {ATTACK_IMPACT} from '../src/action-timing.js';

const world=createWorld(),rows=[];
for(const fps of [30,60,90,144])for(const defensive of [false,true]){
  const state=freshGame();Object.assign(state.player,{x:-75,z:-205});state.respawn={x:-75,z:-205};state.time=360;state.inventory.sword=1;state.inventory.berry=100;state.selected='sword';state.quest=6;
  let blockedFrames=0,steer=0,pending=null,movingFrames=0,distance=0,damage=0,hits=0,respawns=0;
  for(let frame=0;frame<fps*120;frame++){
    const phaseTime=frame/fps,angle=phaseTime*.9+steer,enemy=defensive&&(blockedFrames>=8||pending)?nearestEnemy(state):null;
    const before={x:state.player.x,z:state.player.z};
    movePlayer(state,world.objects,enemy?enemy.x-state.player.x:Math.sin(angle),enemy?enemy.z-state.player.z:Math.cos(angle),1/fps,phaseTime%8<3);
    const moved=Math.hypot(state.player.x-before.x,state.player.z-before.z);distance+=moved;
    if(moved>.001){movingFrames++;blockedFrames=0;}else{blockedFrames++;if(blockedFrames%8===0)steer+=.65;}
    const feedback={};tick(state,1/fps,phaseTime%8<3,feedback,world.objects);damage+=feedback.damage;respawns+=Number(feedback.respawned);
    if(feedback.respawned)pending=null;if(state.player.hp<40)eat(state);
    if(!pending&&enemy&&Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z)<5.2){const result=attack(state,{defer:true});if(result.pending)pending=result.pending;}
    if(pending&&state.time-pending.at>=ATTACK_IMPACT){const result=resolveAttack(state,pending);pending=null;if(result)hits+=result.hits.length;}
  }
  rows.push({fps,defensive,frames:fps*120,movingFrames,movingFraction:movingFrames/(fps*120),distanceMeters:distance,damage,hits,respawns,position:[state.player.x,state.player.z]});
}
const report={scope:'Fixed-dt highland120s controller diagnosis, no rendering/audio/input/save evidence. Both modes use unchanged production movement/tick/collisions; defensive mode faces and attacks a nearby threat only after blocked movement.',rows};
fs.writeFileSync(new URL('../docs/ecosystem-endurance-escape-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
