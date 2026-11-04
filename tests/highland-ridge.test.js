import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {terrain,LANDMARKS,createWorld} from '../src/world.js';
import {createTerrainSurface} from '../src/terrain-grid.js';

const originalSource=execFileSync('git',['show','67b9cc5:src/world.js'],{encoding:'utf8'});
const original=await import('data:text/javascript;base64,'+Buffer.from(originalSource).toString('base64'));
const acceptedSource=execFileSync('git',['show','aa63d205b3b4cceb971c1b15a004d2198a572b44:src/world.js'],{encoding:'utf8'}).replace(/from '([^']+)'/g,(_m,p)=>`from '${new URL('../src/'+p,import.meta.url).href}'`);
const accepted=await import('data:text/javascript;base64,'+Buffer.from(acceptedSource).toString('base64')),acceptedVisible=createTerrainSurface(accepted.terrain);

test('highland summit becomes an asymmetric saddle with two distinct shoulders',()=>{
  const peak=(x0,x1,z0,z1)=>{let height=-Infinity;for(let x=x0;x<=x1;x+=2)for(let z=z0;z<=z1;z+=2)height=Math.max(height,terrain(x,z));return height;};
  const center=terrain(-70,-223),west=peak(-115,-80,-250,-215),east=peak(-60,-25,-265,-230);
  assert(west-center>4,'western shoulder must rise above the saddle');
  assert(east-center>2,'eastern shoulder must rise above the saddle');
  assert(original.terrain(-70,-223)-center>10,'southern summit must visibly change');
});

test('regional composition keeps shorelines, low coastal ground and landmark foundations exact',()=>{
  for(let x=-400;x<=400;x+=5)for(let z=-400;z<=400;z+=5){
    const before=acceptedVisible(x,z),after=terrain(x,z);
    assert.equal(before<.15,after<.15,'water classification');
    if(before<=4&&Math.hypot(x+75,z+235)>=65)assert.equal(after,before,'protected coastal ground');
  }
  for(const o of LANDMARKS)for(let x=-8;x<=8;x+=4)for(let z=-8;z<=8;z+=4)
    assert.equal(terrain(o.x+x,o.z+z),acceptedVisible(o.x+x,o.z+z),'accepted visible landmark foundation');
});

test('ridge height changes remain continuous and resource placement stays on authoritative ground',()=>{
  let maxDelta=0,maxDeltaGradient=0;
  // The closed broad-shoulder profile remains smooth; the new exposed ledges are tested separately.
  const delta=(x,z)=>accepted.terrain(x,z)-original.terrain(x,z);
  for(let x=-140;x<=-10;x+=1)for(let z=-300;z<=-170;z+=1){
    maxDelta=Math.max(maxDelta,Math.abs(delta(x,z)));
    maxDeltaGradient=Math.max(maxDeltaGradient,Math.hypot(delta(x+.5,z)-delta(x-.5,z),delta(x,z+.5)-delta(x,z-.5)));
  }
  assert(maxDelta>10&&maxDelta<25);
  assert(maxDeltaGradient<1.6,'combined broad shoulders must remain continuous');
  for(const o of createWorld().objects)assert.equal(o.y,terrain(o.x,o.z));
});
