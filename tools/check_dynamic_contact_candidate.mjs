import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {actorBlocksMove3D} from './actor_contact_3d_candidate.js';import {actorBlocksMove} from '../src/actor-contact.js';import {createWorld,terrain} from '../src/world.js';
const actor={type:'crab',x:0,z:0};let checked=0;
for(let x=-4;x<=4;x+=.25)for(let z=-4;z<=4;z+=.25)for(const [dx,dz]of [[.07,0],[-.07,0],[0,.07],[0,-.07]]){const a={x,z},b={x:x+dx,z:z+dz};assert.equal(actorBlocksMove3D(a,b,actor,()=>0),actorBlocksMove(a,b,actor));checked++;}
assert.equal(actorBlocksMove3D({x:-4,z:0},{x:4,z:0},actor,()=>0),true);
const root=pathToFileURL(process.cwd()+'/src/').href;
let code=fs.readFileSync('src/game.js','utf8').replaceAll("from './",`from '${root}`);
const {applyDynamicContactCandidate}=await import('./dynamic_contact_candidate.mjs');
const candidate=pathToFileURL(process.cwd()+'/tools/actor_contact_3d_candidate.js').href;
code=applyDynamicContactCandidate(code,candidate);
const game=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const s=JSON.parse(fs.readFileSync('dist/combat-height-recovery-2026-11-12-combat/checkpoint-save.json')),world=createWorld();
let closest=null,minDistance=Infinity;for(let i=0;i<60;i++){game.movePlayer(s,world.objects,-Math.cos(.15),Math.sin(.15),1/60);game.tick(s,1/60,false,null,world.objects);const enemy=s.enemies.find(e=>e.id==='enemy-10'),distance=Math.hypot(s.player.x-enemy.x,s.player.z-enemy.z,terrain(s.player.x,s.player.z)-terrain(enemy.x,enemy.z));if(distance<minDistance){minDistance=distance;closest=structuredClone(s);}}
const e=s.enemies.find(e=>e.id==='enemy-10');const result={flatEquivalenceCases:checked,player:s.player,enemy:e,gap:terrain(s.player.x,s.player.z)-terrain(e.x,e.z),distance3D:Math.hypot(s.player.x-e.x,s.player.z-e.z,terrain(s.player.x,s.player.z)-terrain(e.x,e.z))};
console.log(JSON.stringify(result));assert(minDistance<2.9,'Must approach into existing combat reach');
const target=closest.enemies.find(e=>e.id==='enemy-10');closest.player.yaw=Math.atan2(target.x-closest.player.x,target.z-closest.player.z);closest.time+=1;assert(game.attack(closest).hits.includes(e.id));
fs.mkdirSync('dist/contact-3d-dynamic-2026-11-12',{recursive:true});fs.writeFileSync('dist/contact-3d-dynamic-2026-11-12/result.json',JSON.stringify({...result,minDistance,attackAccepted:true,productionChanged:false},null,2)+'\n');
