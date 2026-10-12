import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,canBuild,build,serialize,restore} from '../src/game.js';

// Count-boundary fixtures use distant, overlapping camps; they are not a playable town.
function atCount(count){
  const state=freshGame();Object.assign(state.inventory,{wood:40,stone:30,fiber:15});
  state.quest=2;state.buildings=Array.from({length:count},(_,i)=>({id:`limit-${i}`,type:'campfire',x:350,z:350}));
  return state;
}

test('the last allowed building consumes materials once and survives restore',()=>{
  const state=atCount(499);
  assert.equal(canBuild(state,[],'tent',-70,108),'');
  assert.equal(build(state,[],'tent',-70,108),'建造完成：帐篷');
  assert.equal(state.buildings.length,500);assert.equal(state.inventory.wood,32);assert.equal(state.inventory.fiber,10);
  assert.deepEqual(state.respawn,{x:-70,z:112});
  const loaded=restore(serialize(state));
  assert.deepEqual(loaded.buildings,state.buildings);assert.deepEqual(loaded.inventory,state.inventory);
  assert.deepEqual(loaded.respawn,state.respawn);assert.equal(loaded.quest,2);
});

test('full camps reject every building without spending, quest or respawn changes',()=>{
  for(const key of ['campfire','tent','workbench']){
    const state=atCount(500),before=serialize(state);
    assert.match(canBuild(state,[],key,-70,108),/500.*上限/);
    assert.equal(build(state,[],key,-70,108),canBuild(state,[],key,-70,108));
    assert.equal(serialize(state),before);
    assert.equal(restore(serialize(state)).buildings.length,500);
  }
});

test('oversized imported saves remain rejected and cannot grow through direct build',()=>{
  const state=atCount(501),before=serialize(state);
  assert.throws(()=>restore(before),/存档建筑数据无效/);
  assert.match(build(state,[],'campfire',-70,108),/500.*上限/);
  assert.equal(serialize(state),before);
  const empty=atCount(0);assert.equal(build(empty,[],'campfire',-70,108),'建造完成：营火');
  assert.equal(empty.quest,3);assert.equal(empty.buildings.length,1);
});
