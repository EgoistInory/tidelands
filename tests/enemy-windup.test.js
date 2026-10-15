import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/game.js';

function encounter(){const s=game.freshGame();s.enemies.forEach(e=>e.hp=0);const e=s.enemies[0];Object.assign(e,{type:'boar',x:s.player.x,z:s.player.z+2.55,hp:70,attackAt:-100});return {s,e};}
test('enemy shows windup first and applies exactly one hit at the rendered impact time',()=>{
  const {s,e}=encounter(),feedback={};game.tick(s,.01,false,feedback);assert.equal(s.player.hp,100);
  assert.deepEqual(feedback.enemyWindups,[{id:e.id,type:'boar'}]);const start=e.attackAt;
  game.tick(s,.29,false,feedback);assert.equal(s.player.hp,100);
  game.tick(s,.011,false,feedback);assert.equal(s.player.hp,88);assert.equal(feedback.damage,12);
  game.tick(s,.2,false,feedback);assert.equal(s.player.hp,88);assert.equal(feedback.damage,0);assert.equal(e.attackAt,start);
});
test('leaving range or circling behind the committed direction makes the attack miss',()=>{
  for(const mode of ['range','behind']){const {s,e}=encounter();game.tick(s,.01);const origin={x:e.x,z:e.z};
    if(mode==='range')s.player.z-=5;else s.player.z=e.z+2.55;
    game.tick(s,.31);assert.equal(s.player.hp,100);assert.equal(e.x,origin.x);assert.equal(e.z,origin.z);
  }
});
test('defeated enemies cannot finish their pending windup',()=>{
  const {s,e}=encounter();game.tick(s,.01);e.hp=0;game.tick(s,.31);assert.equal(s.player.hp,100);
});
test('pause cancellation and save restoration do not resume a stale enemy strike',()=>{
  const {s,e}=encounter();game.tick(s,.01);const bytes=game.serialize(s),loaded=game.restore(bytes);
  assert.equal(typeof game.cancelEnemyAttacks,'function');game.cancelEnemyAttacks(s);game.tick(s,.31);game.tick(loaded,.31);
  assert.equal(s.player.hp,100);assert.equal(loaded.player.hp,100);assert.equal(e.attackAt,s.time-.31);
  assert.equal(game.enemyAttackPose(s,e),null);
});
test('respawn protection prevents even starting a windup until it has expired',()=>{
  const {s,e}=encounter();s.protectedUntil=s.time+.5;game.tick(s,.49);assert.equal(e.attackAt,-100);
  game.tick(s,.02);assert.equal(s.player.hp,100);assert.ok(game.enemyAttackPose(s,e));game.tick(s,.31);assert.equal(s.player.hp,88);
});
test('30, 60 and 144 fps deliver the same single damage event per attack',()=>{
  for(const fps of [30,60,144]){const {s}=encounter();let events=0;const f={};for(let i=0;i<Math.ceil(fps*.8);i++){game.tick(s,1/fps,false,f);if(f.damage)events++;}assert.equal(events,1);assert.equal(s.player.hp,88);}
});
