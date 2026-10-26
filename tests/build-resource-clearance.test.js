import test from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,canBuild,build,isDepleted,nearest,movePlayer,serialize} from '../src/game.js';
import {createWorld} from '../src/world.js';

function supplied(){const s=freshGame();Object.assign(s.inventory,{wood:100,stone:100,fiber:100});Object.assign(s.player,{x:-80,z:112});return s;}
test('large mineral envelope blocks construction even when its centre is beyond three metres',()=>{
  const s=supplied(),node={id:'wide-stone',type:'stone',x:-76,z:118,scale:1.3};
  const before=serialize(s);assert.match(canBuild(s,[node],'campfire',-80,118),/树木|岩石/);
  assert.match(build(s,[node],'campfire',-80,118),/树木|岩石/);assert.equal(serialize(s),before);
});
test('harvesting a solid node cannot permit a structure in its future regrowth footprint',()=>{
  const s=supplied(),node={id:'cut-tree',type:'tree',x:-80,z:118,scale:1};s.depleted[node.id]=s.time+150;
  assert.match(canBuild(s,[node],'tent',-80,118),/恢复|树木|岩石/);assert.equal(s.buildings.length,0);
});
test('legacy construction keeps overlapping regrowth hidden from rendering, targeting and collision without rewriting the save',()=>{
  const s=supplied(),node={id:'legacy-stone',type:'stone',x:-76,z:118,scale:1.3};
  s.buildings=[{id:'existing-camp',type:'campfire',x:-80,z:118}];s.depleted[node.id]=s.time-1;
  const before=serialize(s);assert.equal(isDepleted(s,node),true);assert.equal(serialize(s),before);
  assert.notEqual(nearest(s,[node])?.id,node.id);
  Object.assign(s.player,{x:-82,z:118});movePlayer(s,[node],1,0,.5,false);assert.ok(s.player.x>-79,'hidden mineral must not remain a body blocker');
  s.buildings=[];assert.equal(isDepleted(s,node),false);assert.equal(s.depleted[node.id],s.time-1);
});
test('the actual starter stone cannot regrow through an existing coast camp',()=>{
  const s=supplied(),world=createWorld(),node=world.objects.find(o=>o.id==='starter-1');
  s.buildings=[{id:'old-coast-camp',type:'campfire',x:-80,z:104}];s.depleted[node.id]=s.time+150;s.time+=151;
  const before=serialize(s);assert.equal(isDepleted(s,node),true);assert.equal(serialize(s),before);
});
test('clear land remains buildable and distant resources preserve their normal recovery timer',()=>{
  const s=supplied(),node={id:'far-stone',type:'stone',x:-70,z:118,scale:1};
  assert.equal(canBuild(s,[node],'campfire',-80,118),'');assert.match(build(s,[node],'campfire',-80,118),/建造完成/);
  s.depleted[node.id]=s.time+150;assert.equal(isDepleted(s,node),true);s.time+=151;assert.equal(isDepleted(s,node),false);
});
