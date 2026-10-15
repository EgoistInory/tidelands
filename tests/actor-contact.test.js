import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,movePlayer,tick,attack,interact,nearest,serialize,restore,attackRange,build} from '../src/game.js';
import {LANDMARKS,terrain} from '../src/world.js';

function encounter(type='boar',distance=7){
  const state=freshGame();state.enemies=[];Object.assign(state.player,{x:-70,z:102,yaw:0});
  const enemy={id:'contact-enemy',type,x:-70,z:102+distance,hp:70,attackAt:state.time};state.enemies=[enemy];return {state,enemy};
}
test('walking and long steps cannot cross an islander, but talking and walking around still work',()=>{
  const s=freshGame(),npc=LANDMARKS.find(o=>o.id==='keeper');s.enemies=[];
  Object.assign(s.player,{x:npc.x,z:npc.z-4});movePlayer(s,[],0,1,2);
  assert.ok(s.player.z<npc.z-1);assert.equal(nearest(s,[])?.id,npc.id);interact(s,npc);assert.equal(s.quest,1);
  movePlayer(s,[],1,0,.4);movePlayer(s,[],0,1,1);assert.ok(s.player.z>npc.z);
});
test('chasing boar stops before touching the body and never overshoots on a large tick',()=>{
  for(const dt of [1/60,2]){
    const {state,enemy}=encounter();for(let i=0;i<180;i++)tick(state,dt);
    const distance=Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z);
    assert.ok(distance>=2.54&&distance<2.7,`${dt}: ${distance}`);
  }
});
test('living creatures block player traversal; a defeated creature releases the path',()=>{
  const {state,enemy}=encounter('crab',3);movePlayer(state,[],0,1,1);assert.ok(state.player.z<enemy.z-2.2);
  enemy.hp=0;movePlayer(state,[],0,1,1);assert.ok(state.player.z>enemy.z);
});
test('legacy overlapping saves stay intact on restore and allow walking out',()=>{
  const s=freshGame(),npc=LANDMARKS.find(o=>o.id==='keeper');Object.assign(s.player,{x:npc.x,z:npc.z});
  const loaded=restore(serialize(s));assert.equal(loaded.player.x,npc.x);assert.equal(loaded.player.z,npc.z);
  loaded.enemies=[];movePlayer(loaded,[],1,0,.3);assert.ok(loaded.player.x>npc.x+1);
});
test('boar contact remains reachable with every owned weapon and keeps exact damage and rewards',()=>{
  for(const [selected,damage] of [['hand',12],['axe',23],['sword',38]]){
    const {state,enemy}=encounter('boar',2.55);Object.assign(state.inventory,{axe:1,sword:1});state.selected=selected;
    assert.ok(attackRange(state,enemy)>=2.55);attack(state);assert.equal(enemy.hp,70-damage);
    enemy.hp=1;state.time+=1;attack(state);assert.equal(state.kills,1);assert.equal(state.inventory.fiber,2);assert.equal(state.inventory.berry,4);
  }
});
test('enemy steps respect mineral and islander occupancy without mutating either',()=>{
  const {state,enemy}=encounter('boar',14),node={id:'contact-stone',type:'stone',x:-70,z:107,y:terrain(-70,107),scale:1};
  const before=JSON.stringify(node);for(let i=0;i<60;i++)tick(state,1/60,false,null,[node]);
  assert.ok(enemy.z>=107+2.8+2.2-.01);assert.equal(JSON.stringify(node),before);
});
test('an old exact overlap separates gradually during simulation without teleporting the player',()=>{
  const {state,enemy}=encounter('boar',0),original={...state.player};state.protectedUntil=state.time+8;
  tick(state,1/60);assert.ok(Math.hypot(enemy.x-original.x,enemy.z-original.z)<=4.2/60+1e-8);
  for(let i=0;i<60;i++)tick(state,1/60);
  assert.ok(Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z)>=2.54);
  assert.deepEqual(state.player,original);
});
test('larger body reach is frontal and cannot hit beyond contact allowance',()=>{
  for(const [yaw,z] of [[Math.PI,2.55],[0,2.76]]){
    const {state,enemy}=encounter('boar',z);state.player.yaw=yaw;
    assert.deepEqual(attack(state).hits,[]);assert.equal(enemy.hp,70);
  }
});
test('construction cannot spawn a solid building on a living creature or spend rejected materials',()=>{
  const {state,enemy}=encounter('boar',6);Object.assign(state.inventory,{wood:20,stone:20});const inventory={...state.inventory};
  assert.match(build(state,[],'workbench',enemy.x,enemy.z),/野兽/);assert.deepEqual(state.inventory,inventory);assert.equal(state.buildings.length,0);
  enemy.hp=0;assert.match(build(state,[],'workbench',enemy.x,enemy.z),/建造完成/);assert.equal(state.buildings.length,1);
});
test('nearby pre-existing creature overlaps separate without placing both bodies on the player',()=>{
  const {state,enemy}=encounter('boar',8);state.protectedUntil=state.time+100;
  const other={...enemy,id:'contact-other',x:enemy.x+1};state.enemies.push(other);
  for(let i=0;i<240;i++){const before=state.enemies.map(e=>({x:e.x,z:e.z}));tick(state,1/60);state.enemies.forEach((e,j)=>assert.ok(Math.hypot(e.x-before[j].x,e.z-before[j].z)<=4.2/60+1e-8));}
  assert.ok(Math.hypot(enemy.x-other.x,enemy.z-other.z)>=4.39);
  for(const e of state.enemies)assert.ok(Math.hypot(e.x-state.player.x,e.z-state.player.z)>=2.54);
});
