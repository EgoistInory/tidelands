import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,animateCharacter} from '../src/character.js';
import {createCreature,animateCreature,resetCreature} from '../src/creature.js';

test('traveler recruits the torso into moving turns, settles, and clears inertia on swim/teleport',()=>{
  for(const side of [-1,1]){
    const c=createCharacter(),s={x:0,z:0,yaw:0,time:0,attackAt:-100,selected:'hand'};
    animateCharacter(c,s,1/60,()=>0);let bank=0;
    for(let i=1;i<=90;i++){
      s.yaw=side*Math.min(Math.PI/2,i/60);s.x+=Math.sin(s.yaw)*4/60;s.z+=Math.cos(s.yaw)*4/60;s.time=i/60;c.position.set(s.x,0,s.z);animateCharacter(c,s,1/60,()=>0);
      bank=Math.max(bank,-side*c.userData.body.rotation.z);
    }
    assert.ok(bank>.01&&bank<.13,'moving torso banks into either turn with a bounded angle');
    for(let i=0;i<180;i++){s.time+=1/60;animateCharacter(c,s,1/60,()=>0);}
    assert.ok(Math.abs(c.userData.body.rotation.z)<1e-8&&Math.abs(c.userData.body.rotation.y)<1e-8);
    animateCharacter(c,{...s,swimming:true},1/60,()=>0);assert.equal(c.userData.body.rotation.z,0);assert.equal(c.userData.body.rotation.x,1.25);
    s.x+=100;c.position.x=s.x;animateCharacter(c,s,1/60,()=>0);assert.equal(c.userData.body.rotation.z,0);
  }
});

for(const type of ['boar','crab'])test(type+' turns with its trunk while keeping death/revive/reset independent',()=>{
  const c=createCreature(type),e={x:0,z:0,hp:70,attackAt:-100};let bank=0;
  const target={x:200,z:200};animateCreature(c,e,0,1/60,0,target,null,()=>0);
  for(let i=1;i<=90;i++){
    const yaw=i/60;e.x+=Math.sin(yaw)*2.5/60;e.z+=Math.cos(yaw)*2.5/60;
    animateCreature(c,e,i/60,1/60,0,target,null,()=>0);bank=Math.max(bank,Math.abs(c.userData.body.rotation.z));
  }
  assert.ok(bank>.005&&bank<.10,'bounded living turn response');
  animateCreature(c,{...e,hp:0},2,1/60,0,target,null,()=>0);
  animateCreature(c,{...e,hp:0},2.6,1/60,0,target,null,()=>0);assert.equal(c.visible,false);
  animateCreature(c,e,3,1/60,0,target,null,()=>0);assert.equal(c.userData.body.rotation.z,0);
  resetCreature(c);assert.equal(c.userData.bodyMotion,null);
});
