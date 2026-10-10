import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/game.js';
import {createCharacter,animateCharacter} from '../src/character.js';

function encounter(){
  const state=game.freshGame();state.enemies.forEach(e=>e.hp=0);
  const enemy=state.enemies[0];Object.assign(enemy,{type:'crab',hp:40,x:state.player.x+2.5,z:state.player.z});
  state.inventory.sword=1;state.selected='sword';return {state,enemy};
}

test('deferred attack commits damage at the rendered swing peak and only once',()=>{
  const {state,enemy}=encounter(),at=state.time,rig=createCharacter();
  const started=game.attack(state,{defer:true});
  assert.equal(enemy.hp,40,'wind-up must not deal damage');
  assert.deepEqual(started.hits,[]);assert.equal(state.attackAt,at);
  state.time=at+.225-1e-6;
  assert.equal(game.resolveAttack(state,started.pending),null);assert.equal(enemy.hp,40);
  state.time=at+.225;
  animateCharacter(rig,{...state.player,time:state.time,attackAt:at,selected:'sword'},0,()=>0);
  assert.ok(Math.abs(rig.userData.shoulders[1].rotation.x+2.1)<1e-8);
  const result=game.resolveAttack(state,started.pending);
  assert.deepEqual(result.hits,[enemy.id]);assert.equal(enemy.hp,2);
  assert.equal(game.resolveAttack(state,started.pending),null);assert.equal(enemy.hp,2);
});

test('wind-up reserves the cooldown and kill rewards are committed once at impact',()=>{
  const {state,enemy}=encounter();enemy.hp=10;const at=state.time;
  const first=game.attack(state,{defer:true});
  assert.equal(state.kills,0);assert.equal(state.inventory.berry,3);
  state.time=at+.1;assert.deepEqual(game.attack(state,{defer:true}),{message:'',hits:[]});
  state.time=at+.225;game.resolveAttack(state,first.pending);
  assert.equal(state.kills,1);assert.equal(state.inventory.fiber,2);assert.equal(state.inventory.berry,4);
  game.resolveAttack(state,first.pending);assert.equal(state.kills,1);
  state.time=at+.599;assert.equal(game.attack(state,{defer:true}).pending,undefined);
  state.time=at+.601;assert.ok(game.attack(state,{defer:true}).pending);
});

test('impact uses the starting weapon but the current target distance',()=>{
  const {state,enemy}=encounter(),at=state.time,first=game.attack(state,{defer:true});
  assert.equal(enemy.hp,40);state.selected='hand';state.time=at+.225;
  game.resolveAttack(state,first.pending);assert.equal(enemy.hp,2);
  state.time=at+1;const second=game.attack(state,{defer:true});
  enemy.x=state.player.x+5.3;state.time+=.225;
  assert.deepEqual(game.resolveAttack(state,second.pending).hits,[]);assert.equal(enemy.hp,2);
});

test('cancelled, expired and replaced-save swings cannot damage or survive serialization',()=>{
  for(const reason of ['cancel','expired','reload','different-state']){
    const {state,enemy}=encounter(),at=state.time,result=game.attack(state,{defer:true});
    assert.equal(enemy.hp,40);assert.equal(Object.hasOwn(state,'pendingAttack'),false);
    state.time=at+.225;
    if(reason==='cancel')state.attackAt=-100;
    if(reason==='expired')state.time=at+.451;
    const active=reason==='reload'?game.restore(game.serialize(state)):reason==='different-state'?encounter().state:state;
    assert.equal(game.resolveAttack(active,result.pending),null,reason);assert.equal(enemy.hp,40);
  }
});
