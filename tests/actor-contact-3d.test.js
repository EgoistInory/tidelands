import test from 'node:test';
import assert from 'node:assert/strict';
import {actorBlocksMove,actorBlocksMove3D} from '../src/actor-contact.js';
import {actorBlocksMove3D as candidate} from '../tools/actor_contact_3d_candidate.js';
import {freshGame,movePlayer,tick} from '../src/game.js';
import {terrain,createWorld} from '../src/world.js';

test('production contact preserves flat footprints and sampled candidate across slopes and large steps',()=>{
  const actor={type:'crab',x:0,z:0};
  for(const height of [()=>0,(x,z)=>x*.5,(x,z)=>Math.sin(x)*3+z*.7]){
    for(let x=-4;x<=4;x+=.5)for(let z=-4;z<=4;z+=.5){
      for(const [dx,dz] of [[.07,0],[-.07,0],[0,.07],[0,-.07],[8,0],[-8,2]]){
        const from={x,z},to={x:x+dx,z:z+dz};
        assert.equal(actorBlocksMove3D(from,to,actor,height),candidate(from,to,actor,height));
      }
    }
  }
  for(let x=-4;x<=4;x+=.25)for(let z=-4;z<=4;z+=.25){
    const from={x,z},to={x:x+.07,z};
    assert.equal(actorBlocksMove3D(from,to,actor,()=>0),actorBlocksMove(from,to,actor));
  }
});
test('distant actor sweep needs no terrain queries and vertical separation releases a shelf',()=>{
  const actor={type:'crab',x:0,z:0};
  assert.equal(actorBlocksMove3D({x:50,z:50},{x:51,z:50},actor,()=>{throw Error('unnecessary terrain query');}),false);
  assert.equal(actorBlocksMove3D({x:-4,z:.5},{x:4,z:.5},actor,(x,z)=>z>0?6:0),false);
});
test('captured cliff blockage can descend while the crab moves normally',()=>{
  const state=freshGame(),world=createWorld();
  Object.assign(state.player,{x:-112.78727151264037,z:-226.07464348045164,hp:100});
  state.enemies=[{id:'cliff-crab',type:'crab',x:-114.08568814221437,z:-227.97309396862502,hp:40,attackAt:state.time}];
  let closest=Infinity;
  for(let i=0;i<60;i++){
    movePlayer(state,world.objects,-Math.cos(.15),Math.sin(.15),1/60);
    tick(state,1/60,false,null,world.objects);
    const e=state.enemies[0];closest=Math.min(closest,Math.hypot(state.player.x-e.x,state.player.z-e.z,terrain(state.player.x,state.player.z)-terrain(e.x,e.z)));
  }
  assert(state.player.x< -114,'Must leave the captured blocked X position');
  assert(closest<2.9,'Must enter the existing 3D combat range');
});
