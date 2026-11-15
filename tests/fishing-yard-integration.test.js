import test from 'node:test';import assert from 'node:assert/strict';import * as T from '../vendor/three.module.min.js';
import {freshGame,canBuild,build,serialize,movePlayer} from '../src/game.js';
import {terrain} from '../src/world.js';
import {FISHING_YARD,fishingYardActive,fishingYardBlocksMove,fishingYardIntersectsBuilding} from '../src/fishing-yard-layout.js';
import {createFishingYard} from '../src/fishing-yard.js';
test('rendered yard solid envelopes are contained by the shared gameplay and camera plan',()=>{
 const kit=createFishingYard();try{
  assert.equal(kit.boxes.length,FISHING_YARD.boxes.length);
  for(const box of kit.boxes)assert(FISHING_YARD.boxes.some(([a,b])=>new T.Box3(new T.Vector3(...a),new T.Vector3(...b)).expandByScalar(.002).containsBox(box)));
  assert.equal(kit.posts.length,6);for(const p of kit.posts)assert.equal(p.foot,terrain(p.x,p.z));
 }finally{kit.release();}
});
test('legacy camps, saved players and respawn points take priority without rewriting saves',()=>{
 for(const kind of ['campfire','tent','workbench','player','respawn']){
  const s=freshGame();if(kind==='player'||kind==='respawn')Object.assign(s[kind],{x:-33,z:77});else s.buildings.push({id:'legacy-yard',type:kind,x:-33,z:77});
  const before=serialize(s);assert.equal(fishingYardActive(s),false,kind);assert.equal(serialize(s),before);
  Object.assign(s.player,{x:-70,z:102});assert.equal(fishingYardActive(s),false,'restore decision remains stable for that state');
 }
 const ordinary=freshGame();assert.equal(fishingYardActive(ordinary),true);Object.assign(ordinary.player,{x:-33,z:77});assert.equal(fishingYardActive(ordinary),true,'walking toward a yard must not turn its body off');
});
test('yard blocks a swept crossing while distant movement stays free and legacy-hidden scenery has no body',()=>{
 const s=freshGame();assert(fishingYardActive(s));
 assert.equal(fishingYardBlocksMove(s,{x:-40,z:77},{x:-25,z:77}),true);
 assert.equal(fishingYardBlocksMove(s,{x:-80,z:102},{x:-70,z:102}),false);
 s.buildings.push({id:'existing',type:'tent',x:-33,z:77});const legacy=JSON.parse(serialize(s));assert.equal(fishingYardBlocksMove(legacy,{x:-40,z:77},{x:-25,z:77}),false);
});
test('new placements overlapping the active yard fail without spending or mutating progress',()=>{
 const s=freshGame();Object.keys(s.inventory).forEach(k=>s.inventory[k]=999);assert(fishingYardActive(s));s.player.x=-33;s.player.z=77;
 for(const type of ['campfire','tent','workbench']){
  assert(fishingYardIntersectsBuilding({type,x:-33,z:77}));const before=serialize(s);
  assert.match(canBuild(s,[],type,-33,77),/修船院/);assert.match(build(s,[],type,-33,77),/修船院/);assert.equal(serialize(s),before);
 }
 assert.equal(fishingYardIntersectsBuilding({type:'tent',x:-70,z:108}),false);
});

test('production movement stops at the active hull while a restored inside-player state can leave',()=>{
 const active=freshGame(),hidden=freshGame();assert(fishingYardActive(active));Object.assign(hidden.player,{x:-33,z:77});assert.equal(fishingYardActive(hidden),false);
 for(const state of [active,hidden]){Object.assign(state.player,{x:-40,z:77});for(let i=0;i<120;i++)movePlayer(state,[],1,0,1/60);}
 assert(active.player.x< -37);assert(hidden.player.x> -28);
});

test('the real campfire flame and irregular stones cannot overlap the hull at its edge',()=>{
 const s=freshGame();Object.keys(s.inventory).forEach(k=>s.inventory[k]=999);assert(fishingYardActive(s));Object.assign(s.player,{x:-33,z:79});
 assert(fishingYardIntersectsBuilding({type:'campfire',x:-33,z:79}));assert.match(canBuild(s,[],'campfire',-33,79),/修船院/);
});
