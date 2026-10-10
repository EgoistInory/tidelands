// Deterministic accelerated rule audit. This is NOT real-time/GPU/browser performance evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {freshGame,movePlayer,tick,nearest,interact,attack,eat,craft,serialize,restore} from '../src/game.js';
import {createWorld,LANDMARKS} from '../src/world.js';
const start=performance.now(),world=createWorld();let state=freshGame(),target=0,reloads=0,respawns=0,hits=0,gathers=0;
const route=[...world.objects.filter(o=>['tree','stone','berry','crystal'].includes(o.type)).filter((_,i)=>i%11===0),...LANDMARKS.filter(o=>o.type==='npc')];
const steps=216000,dt=1/60;
for(let step=0;step<steps;step++){
  const goal=route[target%route.length];
  if(Math.hypot(goal.x-state.player.x,goal.z-state.player.z)<5||step%1800===1799)target++;
  movePlayer(state,world.objects,goal.x-state.player.x,goal.z-state.player.z,dt,step%600<300);
  if(tick(state,dt,step%600<300).includes('营地醒来'))respawns++;
  if(step%30===0){
    const message=interact(state,nearest(state,world.objects));if(message.includes(' +'))gathers++;
    hits+=attack(state).hits.length;if(state.player.hp<65)eat(state);craft(state,'axe');
  }
  if(step%60===0){
    for(const value of Object.values(state.player))assert.ok(Number.isFinite(value));
    assert.ok(state.player.hp>0&&state.player.hp<=100);assert.ok(state.player.stamina>=0&&state.player.stamina<=100);
    assert.ok(Math.abs(state.player.x)<=390&&Math.abs(state.player.z)<=390);
    for(const amount of Object.values(state.inventory))assert.ok(Number.isSafeInteger(amount)&&amount>=0);
  }
  if((step+1)%3600===0){
    const loaded=restore(serialize(state));
    assert.deepEqual(loaded.player,state.player);assert.deepEqual(loaded.inventory,state.inventory);
    assert.deepEqual(loaded.buildings,state.buildings);assert.equal(loaded.kills,state.kills);state=loaded;reloads++;
  }
}
console.log(JSON.stringify({kind:'accelerated-rules-only',sourceHash:createHash('sha256').update(readFileSync(new URL('../src/game.js',import.meta.url))).digest('hex'),steps,simulatedSeconds:steps*dt,wallMs:Math.round(performance.now()-start),reloads,respawns,hits,gathers,kills:state.kills,regions:state.discovered,inventory:state.inventory,passed:true},null,2));
