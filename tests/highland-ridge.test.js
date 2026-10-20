import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {terrain,LANDMARKS,createWorld} from '../src/world.js';

const originalSource=execFileSync('git',['show','67b9cc5:src/world.js'],{encoding:'utf8'});
const original=await import('data:text/javascript;base64,'+Buffer.from(originalSource).toString('base64'));

test('highland summit becomes an asymmetric saddle with two distinct shoulders',()=>{
  const center=terrain(-70,-223),west=terrain(-95,-223),east=terrain(-50,-235);
  assert(west-center>4,'western shoulder must rise above the saddle');
  assert(east-center>2,'eastern shoulder must rise above the saddle');
  assert(original.terrain(-70,-223)-center>10,'southern summit must visibly change');
});

test('ridge shape keeps shorelines, other islands and landmark foundations exact',()=>{
  for(let x=-400;x<=400;x+=5)for(let z=-400;z<=400;z+=5){
    const before=original.terrain(x,z),after=terrain(x,z);
    assert.equal(before<.15,after<.15,'water classification');
    if(Math.hypot(x+75,z+235)>=65)assert.equal(after,before,'outside the bounded interior');
  }
  for(const o of LANDMARKS)for(let x=-8;x<=8;x+=4)for(let z=-8;z<=8;z+=4)
    assert.equal(terrain(o.x+x,o.z+z),original.terrain(o.x+x,o.z+z),'landmark foundation');
});

test('ridge height changes remain continuous and resource placement stays on authoritative ground',()=>{
  let maxDelta=0,maxDeltaGradient=0;
  const delta=(x,z)=>terrain(x,z)-original.terrain(x,z);
  for(let x=-140;x<=-10;x+=1)for(let z=-300;z<=-170;z+=1){
    maxDelta=Math.max(maxDelta,Math.abs(delta(x,z)));
    maxDeltaGradient=Math.max(maxDeltaGradient,Math.hypot(delta(x+.5,z)-delta(x-.5,z),delta(x,z+.5)-delta(x,z-.5)));
  }
  assert(maxDelta>10&&maxDelta<16);
  assert(maxDeltaGradient<1,'new shape must not introduce metre-scale height steps');
  for(const o of createWorld().objects)assert.equal(o.y,terrain(o.x,o.z));
});
