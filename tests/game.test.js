import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,terrain,SPAWN,LANDMARKS,regionAt,dayCycle} from '../src/world.js';
import {freshGame,craft,build,canBuild,interact,isDepleted,attack,eat,movePlayer,tick,serialize,restore,nearest,nearestEnemy} from '../src/game.js';
const world=createWorld();
test('starter clearing provides enough materials for the first tool without waiting for respawn',()=>{
  const s=freshGame();
  const resources=world.objects.filter(o=>o.id.startsWith('starter-')&&['tree','stone'].includes(o.type));
  for(const o of resources){assert.ok(Math.hypot(o.x-SPAWN.x,o.z-SPAWN.z)<25);assert.ok(terrain(o.x,o.z)>1);interact(s,o);s.time+=1;}
  assert.match(craft(s,'axe'),/制作完成/);assert.equal(s.inventory.axe,1);
});
test('day labels and lighting share a continuous repeating day cycle',()=>{
  for(const [time,label]of [[0,'夜晚'],[120,'清晨'],[240,'午后'],[360,'黄昏'],[420,'夜晚']])assert.equal(dayCycle(time).label,label);
  assert.equal(dayCycle(240).daylight,1);assert.ok(dayCycle(420).daylight<.1);
  for(let t=0;t<480;t++){const a=dayCycle(t),b=dayCycle(t+480);assert.equal(a.daylight,b.daylight);assert.equal(a.label,b.label);assert.equal(b.day,a.day+1);assert.ok(Math.abs(a.daylight-dayCycle(t+1).daylight)<.02);}
});
test('deterministic, populated world with safe start and diverse regions',()=>{
  assert.deepEqual(createWorld(),world);assert.ok(terrain(SPAWN.x,SPAWN.z)>1);assert.ok(world.objects.length>200);
  for(const type of ['tree','stone','crystal','berry','fiber'])assert.ok(world.objects.some(o=>o.type===type));
  assert.equal(new Set(world.enemies.map(e=>e.type)).size,2);
  for(const p of LANDMARKS)assert.ok(terrain(p.x,p.z)>0,p.id);
  assert.equal(regionAt(-90,5),'潮汐海岸');assert.equal(regionAt(160,-95),'苍翠林地');assert.equal(regionAt(-75,-235),'雾岬高地');
});
test('wood, mineral and food nodes deplete and recover without duplicate rewards',()=>{
  for(const [type,item,label]of [['tree','wood','木材'],['stone','stone','石料'],['berry','berry','浆果']]){
    const s=freshGame(),node=world.objects.find(o=>o.type===type),before=s.inventory[item];
    assert.equal(interact(s,node),`${label} +2`);assert.equal(s.inventory[item],before+2);assert.equal(isDepleted(s,node),true);
    s.time+=1;interact(s,node);assert.equal(s.inventory[item],before+2);
    s.time+=151;assert.equal(isDepleted(s,node),false);interact(s,node);assert.equal(s.inventory[item],before+4);
  }
});
test('craft consumes exact materials, never negative or repeated unique tools',()=>{
  const s=freshGame();assert.match(craft(s,'axe'),/材料不足/);assert.equal(s.inventory.wood,0);
  Object.assign(s.inventory,{wood:20,stone:20});assert.match(craft(s,'axe'),/制作完成/);assert.equal(s.inventory.wood,16);assert.equal(s.inventory.stone,17);assert.equal(s.inventory.axe,1);
  assert.match(craft(s,'axe'),/已经拥有/);assert.equal(s.inventory.wood,16);assert.match(craft(s,'sword'),/材料不足/);
  s.inventory.crystal=3;assert.match(craft(s,'sword'),/工作台/);
});
function buildSpot(s){for(let x=-110;x<-40;x+=3)for(let z=60;z<120;z+=3){s.player.x=x;s.player.z=z-5;if(!canBuild(s,world.objects,'campfire',x,z))return {x,z};}throw new Error('No build spot');}
test('building location checks, material use, persistence and overlap',()=>{
  const s=freshGame();Object.assign(s.inventory,{wood:40,stone:30,fiber:10});const spot=buildSpot(s);
  assert.equal(canBuild(s,world.objects,'campfire',spot.x,spot.z),'');assert.match(build(s,world.objects,'campfire',spot.x,spot.z),/建造完成/);
  assert.equal(s.buildings.length,1);assert.equal(s.inventory.wood,35);assert.match(build(s,world.objects,'campfire',spot.x,spot.z),/太近/);
  s.player.x=380;s.player.z=380;assert.match(build(s,world.objects,'tent',380,380),/水里/);assert.equal(s.buildings.length,1);
});
test('movement normalizes diagonal speed, respects trees and bounds',()=>{
  const a=freshGame(),b=freshGame();a.player.x=b.player.x=350;a.player.z=b.player.z=350;
  movePlayer(a,[],1,0,1);movePlayer(b,[],1,1,1);
  assert.ok(Math.abs(Math.hypot(a.player.x-350,a.player.z-350)-Math.hypot(b.player.x-350,b.player.z-350))<.01);
  a.player.x=390;movePlayer(a,[],1,0,1);assert.equal(a.player.x,390);
  const t=world.objects.find(o=>o.type==='tree');a.player.x=t.x-2;a.player.z=t.z;movePlayer(a,[t],1,0,.2);assert.ok(a.player.x<t.x-1.4);
});
test('attack cooldown and kill rewards happen only once',()=>{
  const s=freshGame(),e=s.enemies[0];e.x=s.player.x+1;e.z=s.player.z;e.hp=10;
  const r=attack(s);assert.ok(r.hits.includes(e.id));assert.equal(s.kills,1);assert.equal(s.inventory.fiber,2);
  attack(s);assert.equal(s.kills,1);s.time+=1;attack(s);assert.equal(s.kills,1);
});
test('food consumes only when healing; camp heals and defeat preserves inventory',()=>{
  const s=freshGame();assert.match(eat(s),/满/);assert.equal(s.inventory.berry,3);
  s.player.hp=40;eat(s);assert.equal(s.player.hp,58);assert.equal(s.inventory.berry,2);
  interact(s,{id:'fire',type:'campfire'});assert.equal(s.player.hp,100);
  s.player.hp=0;s.inventory.wood=11;tick(s,.01);assert.equal(s.player.hp,100);assert.equal(s.inventory.wood,11);assert.equal(s.player.x,s.respawn.x);
});
test('entire six-step quest chain reaches conclusion with no repeat reward',()=>{
  const s=freshGame();const npc=id=>LANDMARKS.find(o=>o.id===id);interact(s,npc('keeper'));assert.equal(s.quest,1);
  Object.assign(s.inventory,{wood:100,stone:100,fiber:20,crystal:10});craft(s,'axe');assert.equal(s.quest,2);
  const spot=buildSpot(s);build(s,world.objects,'campfire',spot.x,spot.z);assert.equal(s.quest,3);
  s.time+=1;interact(s,npc('botanist'));assert.equal(s.quest,4);const berries=s.inventory.berry;s.time+=1;interact(s,npc('botanist'));assert.equal(s.inventory.berry,berries);
  s.time+=1;interact(s,npc('explorer'));assert.equal(s.quest,4);s.kills=2;s.time+=1;interact(s,npc('explorer'));assert.equal(s.quest,5);
  s.time+=1;assert.match(interact(s,npc('lighthouse')),/灯塔亮了/);assert.equal(s.quest,6);const wood=s.inventory.wood;s.time+=1;interact(s,npc('lighthouse'));assert.equal(s.inventory.wood,wood);
});
test('save roundtrip preserves all world changes',()=>{
  const s=freshGame();s.quest=2;s.inventory.axe=1;s.inventory.wood=12;interact(s,world.objects[0]);
  const restored=restore(serialize(s));assert.deepEqual(restored.inventory,s.inventory);assert.deepEqual(restored.depleted,s.depleted);assert.deepEqual(restored.player,s.player);
  assert.equal(restored.quest,s.quest);
});
test('invalid imports rejected without changing running state',()=>{
  for(const mutate of [s=>s.version=2,s=>s.player.x=Infinity,s=>s.player.hp=-5,s=>s.inventory.wood=-1,s=>s.quest=20,s=>s.buildings=[{id:'x',type:'bad',x:0,z:0}],s=>s.enemies=[],s=>s.depleted={bad:4}]){const s=freshGame();mutate(s);assert.throws(()=>restore(JSON.stringify(s)));}
  assert.throws(()=>restore('broken'));
});
test('nearest target respects interaction distance',()=>{
  const s=freshGame();s.player.x=LANDMARKS[0].x;s.player.z=LANDMARKS[0].z;assert.equal(nearest(s,world.objects).id,'keeper');
  s.player.x=380;s.player.z=380;assert.equal(nearest(s,world.objects),null);
});
test('respawn protection survives reload and expires without granting permanent immunity',()=>{
  const s=freshGame(),e=s.enemies[0];e.x=s.respawn.x;e.z=s.respawn.z;s.player.hp=0;
  tick(s,.01);assert.equal(s.player.hp,100);
  const loaded=restore(serialize(s));tick(loaded,1);assert.equal(loaded.player.hp,100);
  tick(loaded,7.1);assert.ok(loaded.player.hp<100);
  s.protectedUntil=s.time+10000;assert.equal(restore(serialize(s)).protectedUntil,s.time+8);
  delete s.protectedUntil;assert.equal(restore(serialize(s)).protectedUntil,0);
});
test('tick reports lethal damage before healing and clears feedback during protection',()=>{
  const s=freshGame(),feedback={};s.enemies.forEach(e=>e.hp=0);
  const e=s.enemies[0];Object.assign(e,{type:'boar',hp:70,x:s.player.x,z:s.player.z,attackAt:0});
  s.player.hp=5;s.inventory.wood=11;
  assert.match(tick(s,.01,false,feedback),/营地醒来/);
  assert.deepEqual(feedback,{damage:5,respawned:true});assert.equal(s.player.hp,100);assert.equal(s.inventory.wood,11);
  assert.equal(Object.hasOwn(s,'damage'),false);assert.equal(Object.hasOwn(s,'respawned'),false);
  tick(s,.01,false,feedback);assert.deepEqual(feedback,{damage:0,respawned:false});
  s.protectedUntil=0;e.attackAt=0;e.x=s.player.x;e.z=s.player.z;
  tick(s,.01,false,feedback);assert.deepEqual(feedback,{damage:12,respawned:false});assert.equal(s.player.hp,88);
});
test('damage follows equipped weapon instead of the strongest item in the bag',()=>{
  for(const [selected,damage]of [['hand',12],['axe',23],['sword',38]]){
    const s=freshGame();Object.assign(s.inventory,{axe:1,sword:1});s.selected=selected;
    const e=s.enemies[0];e.x=s.player.x;e.z=s.player.z;e.hp=100;attack(s);assert.equal(e.hp,100-damage);
    assert.equal(restore(serialize(s)).selected,selected);
  }
  const s=freshGame();s.selected='sword';assert.equal(restore(serialize(s)).selected,'hand');
  Object.assign(s.inventory,{wood:20,stone:20,crystal:3});craft(s,'axe');assert.equal(s.selected,'axe');
  s.buildings.push({id:'bench',type:'workbench',x:s.player.x+6,z:s.player.z});craft(s,'sword');assert.equal(s.selected,'sword');
});

test('duplicate building IDs and malformed entries are rejected with actionable messages',()=>{
  const s=freshGame();const b={id:'camp-1',type:'tent',x:-70,z:108};
  for(const buildings of [[b,{...b,x:-80}],[null],[{...b,id:''}],[{...b,id:'x'.repeat(129)}]]){
    s.buildings=buildings;assert.throws(()=>restore(serialize(s)),/存档建筑数据无效/);
  }
  s.buildings=[];s.enemies[0]=null;assert.throws(()=>restore(serialize(s)),/存档生物数据无效/);
});
test('enemy cooldowns cannot be frozen by malformed or future saved attack times',()=>{
  for(const bad of ['later',null,1e100,-100]){
    const s=freshGame();s.enemies.forEach(e=>e.hp=0);
    Object.assign(s.enemies[0],{x:s.player.x+1,z:s.player.z,hp:40,type:'crab',attackAt:bad});
    const restored=restore(serialize(s));assert.ok(Number.isFinite(restored.enemies[0].attackAt));
    assert.ok(restored.enemies[0].attackAt<=restored.time);
    tick(restored,1.31);assert.equal(restored.player.hp,93);
  }
  const s=freshGame();s.enemies[0].attackAt=s.time-.5;
  assert.equal(restore(serialize(s)).enemies[0].attackAt,s.time-.5);
});

test('sprint exhaustion, swimming and rest preserve a recoverable stamina cycle',()=>{
  const s=freshGame();s.enemies.forEach(e=>e.hp=0);
  movePlayer(s,[],0,1,.5,true);assert.ok(s.player.stamina<100);
  tick(s,.5,true);assert.equal(s.player.stamina,91.5);
  tick(s,1,false);assert.equal(s.player.stamina,100);
  s.player.stamina=1;const z=s.player.z;
  movePlayer(s,[],0,1,.1,true);assert.ok(Math.abs(s.player.z-z-.7)<1e-9);assert.equal(s.player.stamina,1);
  Object.assign(s.player,{x:350,z:350,stamina:40});
  movePlayer(s,[],1,0,1,true);assert.equal(s.player.x,355);assert.equal(s.player.stamina,40);
  Object.assign(s.player,{hp:35,stamina:7});
  interact(s,{id:'camp',type:'tent',x:-70,z:108});
  assert.equal(s.player.hp,100);assert.equal(s.player.stamina,100);assert.deepEqual(s.respawn,{x:-70,z:112});
  const loaded=restore(serialize(s));loaded.player.hp=0;loaded.player.stamina=0;
  tick(loaded,.01);assert.equal(loaded.player.hp,100);assert.equal(loaded.player.stamina,100);
  assert.equal(loaded.player.x,-70);assert.equal(loaded.player.z,112);
});

test('crafted food consumes its ingredients once and never consumes food at full health',()=>{
  const s=freshGame();s.player.hp=40;
  assert.match(craft(s,'meal'),/制作完成/);assert.equal(s.inventory.berry,0);assert.equal(s.inventory.meal,1);
  assert.match(craft(s,'meal'),/材料不足/);assert.equal(s.inventory.meal,1);
  assert.match(eat(s),/烤浆果/);assert.equal(s.player.hp,85);assert.equal(s.inventory.meal,0);
  s.inventory.berry=2;eat(s);assert.equal(s.player.hp,100);assert.equal(s.inventory.berry,1);
  assert.match(eat(s),/满/);assert.equal(s.inventory.berry,1);
  const loaded=restore(serialize(s));assert.equal(loaded.player.hp,100);assert.equal(loaded.inventory.berry,1);
});

test('botanist dialogue matches quest prerequisites and a one-time gift',()=>{
  const s=freshGame(),npc=LANDMARKS.find(o=>o.id==='botanist');s.quest=2;
  assert.match(interact(s,npc),/营火/);assert.equal(s.quest,2);assert.equal(s.inventory.berry,3);
  s.time+=1;s.quest=3;
  assert.match(interact(s,npc),/送你/);assert.equal(s.quest,4);assert.equal(s.inventory.berry,8);
  s.time+=1;assert.doesNotMatch(interact(s,npc),/送你/);assert.equal(s.inventory.berry,8);
  s.time+=1;s.quest=6;assert.match(interact(s,npc),/灯塔/);assert.equal(s.quest,6);assert.equal(s.inventory.berry,8);
});

test('all islanders acknowledge the lit lighthouse after completion without repeating gifts or objectives',()=>{
  const s=freshGame();s.quest=6;s.kills=8;
  const inventory={...s.inventory};
  for(const id of ['keeper','botanist','explorer']){
    const npc=LANDMARKS.find(o=>o.id===id);
    for(let visit=0;visit<2;visit++){
      s.time+=1;
      const dialogue=interact(s,npc);
      assert.match(dialogue,/灯塔|灯火/,id);
      assert.doesNotMatch(dialogue,/风暴熄灭|先采|做一把石斧|灯塔需要|先击退|送给你/,id);
      assert.equal(s.quest,6);assert.equal(s.kills,8);assert.deepEqual(s.inventory,inventory);
    }
  }
});

test('combat target ignores corpses and distant enemies without changing the save',()=>{
  const s=freshGame();s.enemies.forEach(e=>e.hp=0);
  const [far,near,corpse]=s.enemies;
  Object.assign(far,{x:s.player.x+10,z:s.player.z,hp:40});
  Object.assign(near,{x:s.player.x+4,z:s.player.z,hp:70});
  Object.assign(corpse,{x:s.player.x+1,z:s.player.z,hp:-10});
  const before=serialize(s);
  assert.equal(nearestEnemy(s),near);assert.equal(serialize(s),before);
  near.hp=0;assert.equal(nearestEnemy(s),far);
  far.x=s.player.x+15;assert.equal(nearestEnemy(s),null);
});

test('combat target reflects actual weapon damage, cooldown and defeat',()=>{
  const s=freshGame();s.enemies.forEach(e=>e.hp=0);
  const e=s.enemies[0];Object.assign(e,{x:s.player.x+4,z:s.player.z,hp:70});
  s.inventory.axe=1;s.selected='axe';
  attack(s);assert.equal(nearestEnemy(s).hp,47);
  attack(s);assert.equal(nearestEnemy(s).hp,47);
  for(let i=0;i<3;i++){s.time+=1;attack(s);}
  assert.equal(nearestEnemy(s),null);assert.equal(s.kills,1);
  assert.equal(nearestEnemy(restore(serialize(s))),null);
});
