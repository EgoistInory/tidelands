// Production terrain/rig diagnostic; this is not rendered or native gameplay acceptance.
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import {createWorld,terrain} from '../src/world.js';
import {freshGame,movePlayer,tick} from '../src/game.js';
const world=createWorld(),state=freshGame(),root=createCharacter(),dt=1/60;state.enemies=[];state.quest=6;state.selected='axe';state.time=240;Object.assign(state.player,{x:-75,z:-235,yaw:Math.PI});root.rotation.y=Math.PI;
function pose(){const p=state.player;root.position.set(p.x,Math.max(terrain(p.x,p.z),-.45),p.z);animateCharacter(root,{...p,time:state.time,attackAt:-100,selected:'axe'},dt,terrain);root.updateMatrixWorld(true);}
for(let f=0;f<60;f++){tick(state,dt,false);pose();}
let worst=null;const rows=[];
for(let frame=1;frame<=360;frame++){
 if(frame<=300)movePlayer(state,world.objects,frame<=150?0:1,frame<=150?-1:0,dt,true);tick(state,dt,false);pose();
 const rig=root.userData,record={frame,player:{...state.player},pelvisOffset:rig.body.position.y,phase:rig.phase,walkBlend:rig.walkBlend,rootYaw:root.rotation.y,contacts:rig.footContacts,feet:rig.ankles.map(a=>a.getWorldPosition(new THREE.Vector3()).toArray()),plannedFeet:rig.worldFeet.map(v=>v.toArray())};
 if(!worst||record.pelvisOffset<worst.pelvisOffset)worst=record;
 if(frame<=40||frame>=145&&frame<=170)rows.push(record);
}
const report={scope:'Offline production movePlayer/terrain/character; highland sprint then90degree turn,60stationary warmup and360fixed-dt frames. No render/input/full-quality claim.',worst,rows};
fs.writeFileSync(new URL('../docs/world-motion-highland-candidate-probes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({worst},null,2));
