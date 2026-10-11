import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {freshGame,interact,resolveGather,nearest} from '../src/game.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import {GATHER_IMPACT,GATHER_DURATION} from '../src/action-timing.js';

test('production deferred gathering cannot begin five metres from a resource',()=>{
  const state=freshGame(),node={id:'far-resource',type:'tree',x:state.player.x+5,z:state.player.z};
  const result=interact(state,node,{defer:true});
  assert.equal(Boolean(result?.pending),false);assert.match(result,/靠近/);
  assert.equal(state.inventory.wood,0);assert.equal(state.depleted[node.id],undefined);
});
test('walking just outside close gathering range before impact awards nothing',()=>{
  const state=freshGame(),node={id:'near-resource',type:'stone',x:state.player.x+2,z:state.player.z};
  const started=interact(state,node,{defer:true});state.player.x-=1.1;state.time+=GATHER_IMPACT;
  assert.match(resolveGather(state,started.pending),/太远/);
  assert.equal(state.inventory.stone,0);assert.equal(state.depleted[node.id],undefined);
});
test('resource prompts use close range while islanders and camp interactions keep their existing reach',()=>{
  const state=freshGame();Object.assign(state.player,{x:0,z:0});
  const far={id:'far',type:'berry',x:0,z:4},near={id:'near',type:'fiber',x:0,z:2.8};
  assert.equal(nearest(state,[far]),null);assert.equal(nearest(state,[far,near]),near);
  const camp={id:'camp',type:'tent',x:0,z:6};state.buildings=[camp];
  assert.equal(nearest(state,[far]),camp);
  Object.assign(state.player,{x:-59,z:100});state.buildings=[];
  assert.equal(nearest(state,[]).id,'keeper');
});
test('equipped gathering lowers the blade into low resource height without crossing flat ground',()=>{
  for(const selected of ['axe','sword']){
    const root=createCharacter(),blade=root.getObjectByName(selected==='axe'?'axe-head':'sword-blade');
    for(let frame=0;frame<=90;frame++){
      const time=frame*GATHER_DURATION/90;
      animateCharacter(root,{x:0,z:0,yaw:0,time,attackAt:-100,gatherAt:0,selected},1/200,()=>0);root.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(blade);
      assert.ok(bounds.min.y>.12,`${selected} below ground at ${time}`);
    }
    animateCharacter(root,{x:0,z:0,yaw:0,time:GATHER_IMPACT,attackAt:-100,gatherAt:0,selected},1/60,()=>0);root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(blade);
    assert.ok(bounds.min.y<1.5&&bounds.max.y<1.8,`${selected} above resource: ${bounds.min.y}..${bounds.max.y}`);
    assert.ok(bounds.max.z>.8,'blade reaches forward');
  }
});
