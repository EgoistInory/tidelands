import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ISLANDS,SPAWN,LANDMARKS,terrain,createWorld} from '../src/world.js';
import {landformOffset} from '../src/terrain-composition.js';

// Pin the actual pre-change world: coordinate identity and old protected ground are migration contracts.
const prior=await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show','c9f780ff20082976626849a961f9facd4e17d5b5:src/world.js'],{cwd:new URL('..',import.meta.url)})).toString('base64'));

test('each island has metre-scale unequal shoulders and a lower valley instead of a single smooth mound',()=>{
  for(const [region,o] of ISLANDS.entries()){
    let lower=0,higher=0;
    for(let x=o.x-o.r;x<o.x+o.r;x+=5)for(let z=o.z-o.r;z<o.z+o.r;z+=5){
      const delta=terrain(x,z)-prior.terrain(x,z);lower=Math.min(lower,delta);higher=Math.max(higher,delta);
    }
    assert.ok(lower < -2 && higher > 2.5,`region ${region}: ${lower}..${higher}`);
  }
});

test('regional profiles differ after removing rotation and total height scale',async()=>{
  const before=await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show','1ac9e2520ceb7c84b63cd64eb6272a86af4d0ac3:src/terrain-composition.js'],{cwd:new URL('..',import.meta.url)})).toString('base64'));
  const islands=ISLANDS.map((_,i)=>({x:i*1000,z:0,r:100}));
  const signatures=offset=>islands.map((island,i)=>{
    const angle=[.45,-.6,.2,.8][i],values=[];
    for(const a of [-.6,-.3,0,.3,.6])for(const b of [-.45,0,.45]){
      const u=a*Math.cos(angle)-b*Math.sin(angle),v=a*Math.sin(angle)+b*Math.cos(angle);
      values.push(offset(island.x+u*island.r,island.z+v*island.r,20,islands,[]));
    }
    const magnitude=Math.hypot(...values);return values.map(n=>(n/magnitude).toFixed(5)).join(',');
  });
  assert.equal(new Set(signatures(before.landformOffset)).size,1,'baseline really reused one rotated/scaled profile');
  assert.equal(new Set(signatures(landformOffset)).size,ISLANDS.length,'each biome needs its own broad-form profile');
});

test('terrain composition preserves shore water lines and the spawn/landmark working areas',()=>{
  for(let x=-300;x<=300;x+=10)for(let z=-340;z<=290;z+=10){
    const old=prior.terrain(x,z),next=terrain(x,z);
    assert.ok(Number.isFinite(next));if(old<=4)assert.equal(next,old);
    const slope=Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5));
    assert.ok(slope<1.5,`unexpected cliff at ${x},${z}: ${slope}`);
  }
  for(const site of [SPAWN,...LANDMARKS])for(const d of [0,6,12])for(const angle of [0,1,2,3,4,5]){
    const x=site.x+Math.cos(angle)*d,z=site.z+Math.sin(angle)*d;assert.equal(terrain(x,z),prior.terrain(x,z));
  }
});

test('resource identities, footprints, rotation, enemy homes and random layout remain unchanged',()=>{
  const before=prior.createWorld(),after=createWorld(),withoutHeight=world=>world.objects.map(({y,...o})=>o);
  assert.deepEqual(withoutHeight(after),withoutHeight(before));assert.deepEqual(after.enemies,before.enemies);
  assert.ok(after.objects.every(o=>o.y===terrain(o.x,o.z)));
});
