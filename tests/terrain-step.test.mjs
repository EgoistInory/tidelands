import test from 'node:test';import assert from 'node:assert/strict';
import {terrain,SPAWN} from '../src/world.js';import {freshGame,movePlayer} from '../src/game.js';
function emptyAt(x,z){const s=freshGame();s.enemies=[];Object.assign(s.player,{x,z});return s;}
for(const dt of [1/60,.06])test(`real cliff rejects uphill movement at dt=${dt}`,()=>{
 const from={x:-115,z:-225},s=emptyAt(from.x,from.z),distance=7*dt,rise=terrain(from.x+distance,from.z)-terrain(from.x,from.z);
 assert(rise/distance>3&&rise<1.9,'Captured sub-1.9m step on a 3:1 cliff');movePlayer(s,[],1,0,dt);assert.equal(s.player.x,from.x);assert.equal(s.player.z,from.z);
});
test('steep saved positions can retreat downhill and normal coast movement remains available',()=>{
 const s=emptyAt(-114.5,-225);movePlayer(s,[],-1,0,1/60);assert(s.player.x< -114.5);assert(terrain(s.player.x,s.player.z)<terrain(-114.5,-225));
 const coast=emptyAt(SPAWN.x,SPAWN.z);movePlayer(coast,[],1,0,1/60);assert(Math.abs(coast.player.x-SPAWN.x-7/60)<1e-9);
});
