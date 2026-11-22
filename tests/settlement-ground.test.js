import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {settlementBankAt,settlementWearAt,SETTLEMENT_PATH} from '../src/settlement-ground.js';
import {createMeadow,updateCampClearance} from '../src/meadow.js';import {createWorld,randomGenerator} from '../src/world.js';
test('settlement wear connects the camp, keeper and porch and is bounded outside that settlement',()=>{
 for(let i=1;i<SETTLEMENT_PATH.length;i++)for(let u=0;u<=1;u+=.1){const a=SETTLEMENT_PATH[i-1],b=SETTLEMENT_PATH[i];assert(settlementWearAt(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u)>.99);}
 for(const [x,z]of [[0,0],[132,-26],[-88,-267],[-100,95],[-70,130]])assert.equal(settlementWearAt(x,z),0);
 for(let x=-80;x<=-37;x++)for(let z=78;z<117;z++){const w=settlementWearAt(x,z);assert(Number.isFinite(w)&&w>=0&&w<=1);}
});
test('production path clears only local decorative roots and camp updates cannot revive them',()=>{
 const world=createWorld(),before=JSON.stringify(world),a=createMeadow(randomGenerator(4321),world.objects),b=createMeadow(randomGenerator(4321),world.objects,null,{settlement:true});
 assert.equal(a.length,b.length);let hidden=0,bankRoots=0;
 try{for(let j=0;j<a.length;j++){
  const old=a[j].instanceMatrix.array,next=b[j].instanceMatrix.array;assert(next.length>=old.length);
  for(let k=0;k<old.length;k+=16){const masked=settlementWearAt(old[k+12],old[k+14])>.36;
   for(let i=0;i<16;i++)assert.equal(next[k+i],masked&&i===13?-10000:old[k+i]);if(masked)hidden++;
  }
  for(let k=old.length;k<next.length;k+=16){
   const x=next[k+12],z=next[k+14];assert(settlementBankAt(x,z)>.33&&settlementWearAt(x,z)<.36);bankRoots++;
  }
  const initial=[...next];updateCampClearance([b[j]],[{id:'overlap',type:'tent',x:-70,z:108}]);updateCampClearance([b[j]],[]);assert.deepEqual([...next],initial);
 }assert(hidden>5&&hidden<500);assert(bankRoots>50&&bankRoots<250);assert.equal(JSON.stringify(world),before);
 }finally{for(const list of [a,b])for(const g of new Set(list.map(x=>x.geometry)))g.dispose();}
});
