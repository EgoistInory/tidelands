import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {terrain,createWorld,ISLANDS,LANDMARKS,SPAWN} from '../src/world.js';
import {continuousBedrockHeight} from './continuous-bedrock-candidate.js';
const sample=(x,z)=>continuousBedrockHeight(x,z,terrain(x,z),ISLANDS,[SPAWN,...LANDMARKS]);
test('continuous ledges leave the coast and landmark working areas unchanged without height jumps',()=>{
 for(const site of [SPAWN,...LANDMARKS])for(const [x,z]of [[site.x,site.z],[site.x+8,site.z],[site.x,site.z-8]])assert.equal(sample(x,z),terrain(x,z));
 let changed=0;for(let z=-330;z<-135;z+=2.3)for(let x=-175;x<25;x+=2.7){const value=sample(x,z);assert(Number.isFinite(value));assert(Math.abs(value-terrain(x,z))<4.2);assert(Math.abs(sample(x+1e-5,z)-value)<.01);if(Math.abs(value-terrain(x,z))>.5)changed++;}assert(changed>200);
});
test('authority-height candidate keeps all resource identities and follows the new ground Y',async()=>{
 let source=fs.readFileSync(new URL('../src/world.js',import.meta.url),'utf8');source=source.replace('export function terrain(x,z){','function baseTerrain(x,z){');source=source.replace(/from '([^']+)'/g,(_m,p)=>`from '${new URL('../src/'+p,import.meta.url).href}'`);
 source=`import {continuousBedrockHeight} from '${new URL('./continuous-bedrock-candidate.js',import.meta.url).href}';\n`+source+'\nexport function terrain(x,z){return continuousBedrockHeight(x,z,baseTerrain(x,z),ISLANDS,protectedCompositionSites);}';
 const candidate=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),old=createWorld(),next=candidate.createWorld(),identity=o=>{const {y,...rest}=o;return rest;};
 assert.deepEqual(next.objects.map(identity),old.objects.map(identity));assert.deepEqual(next.enemies,old.enemies);assert(next.objects.some((o,i)=>Math.abs(o.y-old.objects[i].y)>.5));for(const o of next.objects)assert.equal(o.y,candidate.terrain(o.x,o.z));
});
