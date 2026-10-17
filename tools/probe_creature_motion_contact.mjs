import fs from 'node:fs';
import crypto from 'node:crypto';
import {createCreature,animateCreature} from '../src/creature.js';
const rows=[],output=process.argv[2]??'docs/creature-motion-contact-current.json';
for(const type of ['boar','crab'])for(const slope of [false,true]){
  const root=createCreature(type),speed=type==='boar'?4.2:2.5,floor=slope?(x,z)=>4+.25*x-.18*z:()=>4;
  const e={x:0,z:0,hp:70,attackAt:-100},frames=[];let previous=null;
  for(let frame=0;frame<300;frame++){
    // Two seconds straight, one turning, one stopped, one restarted; declared kinematic fixture.
    const angle=frame<120?0:Math.PI/2,moving=frame<180||frame>=240;
    if(moving){e.x+=Math.sin(angle)*speed/60;e.z+=Math.cos(angle)*speed/60;}
    animateCreature(root,e,frame/60,1/60,floor(e.x,e.z),{x:e.x+Math.sin(angle)*100,z:e.z+Math.cos(angle)*100},null,floor);root.updateMatrixWorld(true);
    const feet=root.userData.contacts.map(({leg,point})=>{const p=point.clone().applyMatrix4(leg.matrixWorld);return {position:p.toArray(),gap:p.y-floor(p.x,p.z)};});
    const slips=[];if(previous)feet.forEach((f,i)=>{if(Math.abs(f.gap)<.04&&Math.abs(previous[i].gap)<.04)slips.push(Math.hypot(f.position[0]-previous[i].position[0],f.position[2]-previous[i].position[2]));});
    frames.push({frame,moving,gaps:feet.map(f=>f.gap),supportPointHorizontalDisplacements:slips});previous=feet;
  }
  rows.push({type,slope,speed,frames,minGap:Math.min(...frames.flatMap(f=>f.gaps)),maxGap:Math.max(...frames.flatMap(f=>f.gaps)),maxSupportPointDisplacementPerFrame:Math.max(0,...frames.flatMap(f=>f.supportPointHorizontalDisplacements)),supportPointSamples:frames.reduce((n,f)=>n+f.supportPointHorizontalDisplacements.length,0)});
}
const sourceSha256=Object.fromEntries(['src/creature.js','src/action-timing.js','tools/probe_creature_motion_contact.mjs'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
fs.writeFileSync(output,JSON.stringify({kind:'creature-motion-contact-diagnostic',sourceSha256,rows,physicalContactAccepted:false,scope:'300 fixed 60Hz frames per type/plane at production enemy speeds; declared kinematic path, no game AI or browser. Points are existing rig bounding-bottom contact proxies, not all sole vertices. Near-ground proxy displacement diagnoses sliding, not physical stance or complete motion quality.'},null,2)+'\n');
console.log(JSON.stringify(rows.map(({frames,...r})=>r)));
