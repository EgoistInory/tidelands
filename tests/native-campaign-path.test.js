import test from 'node:test';import assert from 'node:assert/strict';
import {world,clearSegment} from '../tools/journey_path.mjs';
import {bindCampaignContacts} from '../tools/campaign_contact_plan.mjs';
import {freshGame,movePlayer} from '../src/game.js';
test('ordinary journey planner rejects the actual authored-tree obstruction seen in native movement',()=>{
 const original=JSON.stringify(world),contacts=bindCampaignContacts(world),state=freshGame();
 try{assert.equal(contacts.coastal,133);assert.equal(contacts.inland,15);assert.equal(JSON.stringify(world),original,'planner metadata must not rewrite copied world records');
  Object.assign(state.player,{x:-128.9492425996471,z:61.99822898874023});const from={...state.player},to={x:from.x-.15*.45,z:from.z-.99*.45},copy=structuredClone(state),before=JSON.stringify(state);
  movePlayer(copy,world.objects,-.15,-.99,.45*Math.hypot(.15,.99)/7);assert.ok(Math.hypot(copy.player.x-to.x,copy.player.z-to.z)>.4,'declared native obstruction no longer reproduced');
  assert.equal(clearSegment(state,from,to),false,'planner must not repeatedly request a move production physics rejects');assert.equal(JSON.stringify(state),before);
 }finally{contacts.release();}
});
