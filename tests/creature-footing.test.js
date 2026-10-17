import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCreature,animateCreature,resetCreature} from '../src/creature.js';
for(const type of ['boar','crab'])for(const slope of [false,true])test(`${type}: actual articulated contacts remain planted through travel, turning and stopping (${slope?'slope':'flat'})`,()=>{
  const floor=slope?(x,z)=>4+.25*x-.18*z:()=>4,root=createCreature(type),speed=type==='boar'?4.2:2.5;
  const enemy={x:0,z:0,hp:70,attackAt:-100};let previous=null,plantedSamples=0,swingSamples=0,maxSlide=0;
  for(let frame=0;frame<360;frame++){
    const moving=frame<180||frame>=240,angle=frame<120?0:Math.PI/2;
    if(moving){enemy.x+=Math.sin(angle)*speed/60;enemy.z+=Math.cos(angle)*speed/60;}
    animateCreature(root,enemy,frame/60,1/60,floor(enemy.x,enemy.z),{x:enemy.x+Math.sin(angle)*100,z:enemy.z+Math.cos(angle)*100},null,floor);root.updateMatrixWorld(true);
    const rig=root.userData;assert.equal(rig.footContacts?.length,type==='boar'?4:8,'a root lift is not a stance solver');
    const feet=rig.contacts.map(({leg,point})=>point.clone().applyMatrix4(leg.matrixWorld));
    feet.forEach((p,i)=>{
      assert.ok(Number.isFinite(p.x+p.y+p.z));
      if(rig.footContacts[i]){
        plantedSamples++;assert.ok(Math.abs(p.y-floor(p.x,p.z))<.015,`planted foot gap ${p.y-floor(p.x,p.z)} at frame${frame}`);
        if(previous?.contacts[i])maxSlide=Math.max(maxSlide,Math.hypot(p.x-previous.feet[i].x,p.z-previous.feet[i].z));
      }else if(p.y-floor(p.x,p.z)>.04)swingSamples++;
    });
    previous={feet,contacts:[...rig.footContacts]};
  }
  assert.ok(plantedSamples>500,'cannot pass by declaring every foot airborne');assert.ok(swingSamples>80,'swing feet need clearance');
  assert.ok(maxSlide<.015,`planted contact slipped ${maxSlide}m in one 60Hz frame`);
  resetCreature(root);assert.equal(root.userData.worldFeet,null);assert.equal(root.userData.footContacts,null);
});

test('articulated geometry stays shared while joints, reset and revived contacts stay private',()=>{
  const cache=new Map(),a=createCreature('boar',cache),b=createCreature('boar',cache);
  const meshes=root=>{const result=[];root.userData.body.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
  const am=meshes(a),bm=meshes(b);assert.equal(am.length,bm.length);am.forEach((m,i)=>assert.equal(m.geometry,bm[i].geometry));
  const floor=()=>2,enemy={x:0,z:0,hp:70,attackAt:-100};
  animateCreature(a,enemy,1,1/60,2,{x:0,z:100},null,floor);
  animateCreature(a,{...enemy,z:.07},1.1,1/60,2,{x:0,z:100},null,floor);
  assert.equal(b.userData.worldFeet,null);assert.equal(b.userData.contacts[0].knee.quaternion.w,1);
  animateCreature(a,{...enemy,hp:0},2,1/60,2,{x:0,z:100},null,floor);
  assert.equal(a.userData.worldFeet,null);
  animateCreature(a,{...enemy,x:30},3,1/60,2,{x:30,z:100},null,floor);
  assert.ok(a.userData.worldFeet.every(p=>Math.abs(p.x-30)<3));
  resetCreature(a);for(const c of a.userData.contacts){assert.equal(c.knee.quaternion.w,1);assert.equal(c.ankle.quaternion.w,1);}
  assert.equal(a.userData.worldFeet,null);assert.equal(cache.get('boar').references,2);
  a.userData.releaseDistant();assert.equal(cache.get('boar').references,1);b.userData.releaseDistant();assert.equal(cache.size,0);
});
