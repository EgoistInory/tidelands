import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/game.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import {terrain} from '../src/world.js';

function resource(type='stone'){
  const state=game.freshGame(),object={id:'starter-1',type,x:state.player.x+2,z:state.player.z};
  return {state,object};
}

test('gather commits inventory and depletion once at the rendered reach peak',()=>{
  const {state,object}=resource(),at=state.time,rig=createCharacter();
  const started=game.interact(state,object,{defer:true});
  assert.equal(state.inventory.stone,0,'reach must finish before awarding resources');
  assert.equal(game.isDepleted(state,object),false);assert.equal(state.interactAt,at);
  state.time=at+.21-1e-6;assert.equal(game.resolveGather(state,started.pending),null);
  state.time=at+.21;
  animateCharacter(rig,{...state.player,time:state.time,attackAt:-100,gatherAt:at,selected:'hand'},0,()=>0);
  assert.ok(Math.abs(rig.userData.shoulders[1].rotation.x+1.6)<1e-8);
  assert.equal(game.resolveGather(state,started.pending),'石料 +2');
  assert.equal(state.inventory.stone,2);assert.equal(state.depleted[object.id],state.time+150);
  assert.equal(game.resolveGather(state,started.pending),null);assert.equal(state.inventory.stone,2);
});

test('gather reserves interaction cooldown and locks the starting tool yield',()=>{
  const {state,object}=resource('tree'),at=state.time;state.inventory.axe=1;
  const started=game.interact(state,object,{defer:true});assert.equal(state.inventory.wood,0);
  state.time=at+.1;assert.equal(game.interact(state,object,{defer:true}),'');
  state.inventory.axe=0;state.time=at+.21;
  assert.equal(game.resolveGather(state,started.pending),'木材 +3');
  state.time=at+1;assert.equal(game.interact(state,object,{defer:true}),'这里的资源还在恢复。');
});

test('leaving range or losing the resource before impact awards nothing',()=>{
  for(const reason of ['range','depleted']){
    const {state,object}=resource(),at=state.time,started=game.interact(state,object,{defer:true});
    assert.equal(state.inventory.stone,0);state.time=at+.21;
    if(reason==='range')state.player.x+=10;else state.depleted[object.id]=state.time+150;
    const result=game.resolveGather(state,started.pending);assert.ok(result&&!result.includes(' +'),reason);
    assert.equal(state.inventory.stone,0);assert.equal(game.resolveGather(state,started.pending),null);
    if(reason==='range')assert.equal(game.isDepleted(state,object),false);
  }
});

test('expired, cancelled and replaced-save gathers never commit; NPCs remain immediate',()=>{
  for(const reason of ['cancel','expired','reload','different-state']){
    const {state,object}=resource(),at=state.time,started=game.interact(state,object,{defer:true});
    assert.equal(state.inventory.stone,0);assert.equal(Object.hasOwn(state,'pendingGather'),false);
    state.time=at+.21;if(reason==='cancel')state.interactAt=-100;if(reason==='expired')state.time=at+.421;
    const active=reason==='reload'?game.restore(game.serialize(state)):reason==='different-state'?game.freshGame():state;
    assert.equal(game.resolveGather(active,started.pending),null,reason);assert.equal(state.inventory.stone,0);
  }
  const state=game.freshGame();assert.match(game.interact(state,{id:'keeper',type:'npc'},{defer:true}),/^阿岚：/);assert.equal(state.quest,1);
});

test('swimming cannot start or finish a hidden gathering animation',()=>{
  const {state,object}=resource(),started=game.interact(state,object,{defer:true});
  assert.equal(state.inventory.stone,0);state.player.x=390;state.player.z=390;assert.ok(terrain(390,390)<.15);state.time+=.21;
  assert.equal(game.resolveGather(state,started.pending),'请先靠岸，再采集附近资源。');
  state.time+=1;assert.equal(game.interact(state,object,{defer:true}),'请先靠岸，再采集附近资源。');
  assert.equal(state.inventory.stone,0);assert.equal(game.isDepleted(state,object),false);
});
