import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {freshGame,attack,resolveAttack} from '../src/game.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import {ATTACK_IMPACT,ATTACK_DURATION} from '../src/action-timing.js';

function encounter(selected,x,z,yaw=0){
  const state=freshGame();Object.assign(state.player,{x:0,z:0,yaw});
  state.enemies=[{id:'target',type:'crab',x,z,hp:100,attackAt:state.time}];
  Object.assign(state.inventory,{axe:1,sword:1});state.selected=selected;return state;
}
test('a strike cannot damage a target behind, to the side or beyond the blade reach',()=>{
  for(const [x,z] of [[0,-2.3],[2.3,0],[0,5.1]]){
    const state=encounter('sword',x,z),result=attack(state);
    assert.deepEqual(result.hits,[],`${x},${z}`);assert.equal(state.enemies[0].hp,100);
  }
});
test('weapon reach preserves close combat while a longer sword reaches farther',()=>{
  for(const [selected,z,damage] of [['hand',2.3,12],['hand',2.5,0],['axe',2.5,23],['axe',3,0],['sword',3,38],['sword',3.3,0]]){
    const state=encounter(selected,0,z);attack(state);
    assert.equal(state.enemies[0].hp,100-damage,`${selected}/${z}`);
  }
  const missing=encounter('sword',0,3);missing.inventory.sword=0;attack(missing);
  assert.equal(missing.enemies[0].hp,100,'unowned sword must not extend bare-hand reach');
});
test('impact keeps starting weapon reach but checks current position and facing',()=>{
  const state=encounter('sword',0,3),first=attack(state,{defer:true});
  state.selected='hand';state.time+=ATTACK_IMPACT;
  assert.deepEqual(resolveAttack(state,first.pending).hits,['target']);
  state.time+=1;state.selected='sword';const second=attack(state,{defer:true});
  state.player.yaw=Math.PI;state.time+=ATTACK_IMPACT;
  assert.deepEqual(resolveAttack(state,second.pending).hits,[]);
  state.time+=1;state.player.yaw=0;const third=attack(state,{defer:true});
  state.enemies[0].z=3.3;state.time+=ATTACK_IMPACT;
  assert.deepEqual(resolveAttack(state,third.pending).hits,[]);
});
test('turning toward the target makes side combat possible without changing cooldown or rewards',()=>{
  const state=encounter('axe',2.3,0,Math.PI/2);state.enemies[0].hp=20;
  const result=attack(state,{defer:true});state.time+=ATTACK_IMPACT;
  assert.deepEqual(resolveAttack(state,result.pending).hits,['target']);assert.equal(state.kills,1);
  assert.equal(state.inventory.fiber,2);assert.equal(state.inventory.berry,4);
  assert.equal(resolveAttack(state,result.pending),null);assert.equal(attack(state).pending,undefined);
});
test('each equipped weapon blade passes through low target height at impact and stays above flat ground',()=>{
  for(const selected of ['axe','sword']){
    const root=createCharacter(),blade=root.getObjectByName(selected==='axe'?'axe-head':'sword-blade');
    for(let frame=0;frame<=90;frame++){
      const time=frame*ATTACK_DURATION/90;
      animateCharacter(root,{x:0,z:0,yaw:0,time,attackAt:0,selected},1/200,()=>0);root.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(blade);
      assert.ok(box.min.y>.12,`${selected} ground penetration at ${time}: ${box.min.y}`);
    }
    animateCharacter(root,{x:0,z:0,yaw:0,time:ATTACK_IMPACT,attackAt:0,selected},1/60,()=>0);root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(blade);
    assert.ok(box.min.y<1.4&&box.max.y<2,`${selected} impact above target: ${box.min.y}..${box.max.y}`);
    if(selected==='axe')assert.ok(box.min.y<1.1&&box.max.y<1.25,`axe must reach the crab shell: ${box.min.y}..${box.max.y}`);
    assert.ok(box.min.z>.2&&box.max.z>.8,`${selected} impact must extend in front`);
  }
});
