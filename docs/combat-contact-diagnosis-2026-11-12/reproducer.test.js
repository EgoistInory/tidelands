import test from 'node:test';import assert from 'node:assert/strict';
import {freshGame,movePlayer,tick} from '../../src/game.js';import {createWorld,terrain} from '../../src/world.js';
test('a crab on a lower shelf cannot horizontally pin a descending player',()=>{
 const s=freshGame();Object.assign(s.player,{x:-112.78727151264037,z:-227.18211453640046});s.time=1500;
 s.enemies=[{id:'enemy-10',type:'crab',x:-114.62683768155902,z:-228.5626927884999,hp:40,attackAt:0}];const objects=createWorld().objects;
 for(let i=0;i<60;i++){movePlayer(s,objects,-Math.cos(.15),Math.sin(.15),1/60);tick(s,1/60,false,null,objects);}
 assert(s.player.x<-114,'Player should be able to descend instead of being pinned by a non-overlapping body below');
 assert(Math.abs(terrain(s.player.x,s.player.z)-terrain(s.enemies[0].x,s.enemies[0].z))<3);
});
