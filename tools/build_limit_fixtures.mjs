import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createWorld} from '../src/world.js';
import {freshGame,canBuild,build,restore,serialize} from '../src/game.js';

// Explicit stress fixtures: each existing camp is built through the production rules.
// This does not claim a player collected the materials or visited these sites normally.
const state=freshGame(),objects=createWorld().objects;
Object.assign(state.inventory,{wood:3000,stone:2000,fiber:15});state.quest=2;
for(let x=-350;x<=350&&state.buildings.length<499;x+=7){
  for(let z=-350;z<=350&&state.buildings.length<499;z+=7){
    if(Math.hypot(x+70,z-108)<16)continue;
    Object.assign(state.player,{x,z});
    if(canBuild(state,objects,'campfire',x,z))continue;
    assert.equal(build(state,objects,'campfire',x,z),'建造完成：营火');
  }
}
assert.equal(state.buildings.length,499);Object.assign(state.player,{x:-70,z:102,yaw:0});
Object.assign(state.inventory,{wood:40,stone:30,fiber:15});state.protectedUntil=128;
assert.equal(canBuild(state,objects,'tent',-70,108),'');
const valid499=serialize(state);restore(valid499);
writeFileSync(new URL('../tests/fixtures/build-limit-499.json',import.meta.url),valid499+'\n');
assert.equal(build(state,objects,'tent',-70,108),'建造完成：帐篷');
const valid500=serialize(state);restore(valid500);
writeFileSync(new URL('../tests/fixtures/build-limit-500.json',import.meta.url),valid500+'\n');
state.buildings.push({id:'invalid-501',type:'campfire',x:380,z:380});
const invalid501=serialize(state);assert.throws(()=>restore(invalid501),/存档建筑数据无效/);
writeFileSync(new URL('../tests/fixtures/build-limit-501-invalid.json',import.meta.url),invalid501+'\n');
console.log(JSON.stringify({kind:'explicit-production-rule-generated-count-fixtures',existing499Valid:true,lastBuild500Valid:true,invalid501Rejected:true,source:'tools/build_limit_fixtures.mjs',normalPlaythrough:false}));
