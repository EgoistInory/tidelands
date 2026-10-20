import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld} from '../src/world.js';

const baseline=JSON.parse(fs.readFileSync(new URL('../docs/landform-identity-baseline.json',import.meta.url)));
const identities=world=>({resources:world.objects.map(o=>[o.id,o.type,o.x,o.z,o.scale,o.rotation]),enemies:world.enemies.map(o=>[o.id,o.type,o.x,o.z,o.hp,o.homeX,o.homeZ])});

test('landform preparation preserves every existing resource and enemy identity',()=>{
  assert.deepEqual(identities(createWorld()),{resources:baseline.resources,enemies:baseline.enemies});
});

test('an isolated highland height change cannot reshuffle saved resource IDs',async()=>{
  const source=fs.readFileSync(new URL('../src/world.js',import.meta.url),'utf8');
  const changed=source.replace('export function terrain(x,z){','function originalTerrain(x,z){')+`
    export function terrain(x,z){
      const u=(x+75)/65,v=(z+235)/65,w=Math.max(0,1-u*u-v*v);
      return originalTerrain(x,z)+w*w*(8*Math.exp(-((u+.38)**2*11+(v-.12)**2*4))+6*Math.exp(-((u-.4)**2*13+(v+.28)**2*5))-12*Math.exp(-(u*u*9+v*v*5)));
    }`;
  const candidate=await import('data:text/javascript;base64,'+Buffer.from(changed).toString('base64'));
  const world=candidate.createWorld();
  assert.deepEqual(identities(world),{resources:baseline.resources,enemies:baseline.enemies});
  assert(world.objects.some(o=>Math.abs(o.y-createWorld().objects.find(b=>b.id===o.id).y)>1));
  for(const o of world.objects)assert.equal(o.y,candidate.terrain(o.x,o.z),'rendered nodes must use authoritative height');
});
