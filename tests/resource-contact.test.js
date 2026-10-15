import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,terrain} from '../src/world.js';
import {freshGame,movePlayer,nearest,interact,resolveGather,restore,serialize} from '../src/game.js';
import {GATHER_IMPACT} from '../src/action-timing.js';

test('the recorded forest route cannot walk through crystal944 or cross its camera origin box',()=>{
  const world=createWorld(),node=world.objects.find(o=>o.id==='resource-944'),s=freshGame();s.enemies=[];
  Object.assign(s.player,{x:132,z:-45});
  const radius=1.5*node.scale;
  for(let frame=0;frame<180;frame++){
    movePlayer(s,world.objects,Math.cos(.15),-Math.sin(.15),1/60,false);
    assert.ok(Math.abs(s.player.x-node.x)>=radius||Math.abs(s.player.z-node.z)>=radius,'character must stay outside the crystal camera box');
    if(frame===49)assert.ok(s.player.x<node.x,'the recorded failure frame must stop at the deposit edge');
  }
});
test('scaled stone remains reachable at its surface and grants the original yield once',()=>{
  const s=freshGame(),node={id:'resource-contact-rock',type:'stone',x:-70,z:102,y:terrain(-70,102),scale:1.6};
  Object.assign(s.player,{x:node.x+2.8*node.scale+.7,z:node.z});
  assert.equal(nearest(s,[node]),node,'large deposits must be gathered from their edge');
  const result=interact(s,node,{defer:true});assert.ok(result?.pending);
  s.time+=GATHER_IMPACT;assert.equal(resolveGather(s,result.pending),'石料 +2');
  assert.equal(s.inventory.stone,2);assert.equal(resolveGather(s,result.pending),null);
  movePlayer(s,[node],-1,0,.6,false);assert.ok(s.player.x<node.x+2.8*node.scale,'depleted deposits no longer block movement');
});
test('surface gathering cannot finish after moving out of arm reach',()=>{
  const s=freshGame(),node={id:'contact-crystal',type:'crystal',x:-70,z:102,y:terrain(-70,102),scale:1};
  Object.assign(s.player,{x:-67.8,z:102});const result=interact(s,node,{defer:true});assert.ok(result?.pending);
  s.player.x+=1;s.time+=GATHER_IMPACT;
  assert.match(resolveGather(s,result.pending),/太远/);assert.equal(s.inventory.crystal,0);
});
test('legacy saves inside a deposit can move outward without losing progress or being teleported',()=>{
  const s=freshGame(),node={id:'old-contact-rock',type:'stone',x:-70,z:102,y:terrain(-70,102),scale:1};
  s.quest=6;const loaded=restore(serialize(s));assert.equal(loaded.player.x,-70);
  for(let i=0;i<20;i++)movePlayer(loaded,[node],-1,0,.05,false);
  assert.ok(loaded.player.x<-73.15,'existing inside positions must have an escape route');assert.equal(loaded.quest,6);
});
test('a large movement step cannot tunnel across a live deposit',()=>{
  const s=freshGame(),node={id:'contact-large-step',type:'crystal',x:-70,z:102,y:terrain(-70,102),scale:.7};
  s.player.x=-72;movePlayer(s,[node],1,0,1,false);assert.equal(s.player.x,-72);
});
