import fs from 'node:fs';import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';import {freshGame,movePlayer,tick} from '../src/game.js';import {createWorld,terrain} from '../src/world.js';
const rows=[];
for(const fps of [30,60,144]){
 const root=createCharacter(),s=freshGame(),world=createWorld(),dt=1/fps;s.enemies=[];s.time=240;Object.assign(s.player,{x:-75,z:-235,yaw:Math.PI});root.rotation.y=Math.PI;
 const pose=()=>{const p=s.player;root.position.set(p.x,terrain(p.x,p.z),p.z);animateCharacter(root,{...p,time:s.time,attackAt:-100,selected:'axe'},dt,terrain);root.updateMatrixWorld(true);};
 for(let i=0;i<fps;i++){tick(s,dt,false);pose();}
 let worst=null;
 for(let frame=1;frame<=fps*6;frame++){
  if(frame<=fps*5)movePlayer(s,world.objects,frame<=fps*2.5?0:1,frame<=fps*2.5?-1:0,dt,true);tick(s,dt,false);pose();
  const r=root.userData;if(!worst||r.body.position.y<worst.bodyY)worst={fps,frame,bodyY:r.body.position.y,position:{...s.player},time:s.time,rootHeight:root.position.y,phase:r.phase,walkBlend:r.walkBlend,moving:r.moving,contacts:r.footContacts,feet:r.worldFeet.map(p=>p.toArray()),locals:r.worldFeet.map(p=>root.worldToLocal(p.clone()).toArray()),bodyRotation:r.body.rotation.toArray()};
 }rows.push(worst);
}
const out=process.argv[2]??'docs/bedrock-delivery-2026-11-05/fallback-motion-before.json';if(fs.existsSync(out))throw Error('Preserve prior trace');fs.writeFileSync(out,JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows));
