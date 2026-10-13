// Offline production camera solver diagnostic. No browser, saves, textures or GPU.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {terrain,LANDMARKS} from '../src/world.js';
import {unobstructedCamera} from '../src/camera.js';

const root=new URL('../',import.meta.url);
const saved=JSON.parse(fs.readFileSync(new URL('docs/current-journey-final-handoff-save.json',root),'utf8'));
const cases=[{name:'ordinary-ending-export',...saved.player},{name:'ordinary-lamp-hand-in',x:-86.9,z:-51.9},{name:'ordinary-highland-tree',x:-86.5,z:-176.2},{name:'forest-botanist',x:132,z:-26}];
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const rows=[];
for(const p of cases){
  const h=Math.max(terrain(p.x,p.z),-.45),focus=new THREE.Vector3(p.x,h+2.4,p.z);
  // These are exactly the landmark boxes in scene.draw; resource boxes are excluded.
  const boxes=LANDMARKS.filter(o=>['lighthouse','cottage'].includes(o.type)&&Math.hypot(o.x-p.x,o.z-p.z)<26).map(o=>{
    const r=o.type==='lighthouse'?3.2:5,y=terrain(o.x,o.z);
    return new THREE.Box3(new THREE.Vector3(o.x-r,y,o.z-r),new THREE.Vector3(o.x+r,y+(o.type==='lighthouse'?25:9),o.z+r));
  });
  for(const pitch of [.08,.29,.88])for(let i=0;i<24;i++){
    const requestedYaw=i*Math.PI/12;
    const desired=new THREE.Vector3(p.x+Math.sin(requestedYaw)*14,h+2.4+Math.tan(pitch)*14,p.z+Math.cos(requestedYaw)*14);
    desired.y=Math.max(desired.y,terrain(desired.x,desired.z)+1.5);
    const safe=unobstructedCamera(focus,desired,boxes,terrain,6);
    const resolvedYaw=Math.atan2(safe.x-p.x,safe.z-p.z),changeDegrees=Math.abs(angleDelta(resolvedYaw,requestedYaw))*180/Math.PI;
    if(changeDegrees>1)rows.push({case:p.name,position:[p.x,p.z],pitch,requestedYaw,resolvedYaw,changeDegrees,framingDistance:safe.distanceTo(focus),landmarkBoxes:boxes.length});
  }
}
const bindings=Object.fromEntries(['src/camera.js','src/scene.js','src/main.js','src/movement-heading.js','src/world.js','docs/current-journey-final-handoff-save.json'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex')]));
const report={kind:'offline-camera-request-overwrite-diagnostic',sourceSha256:bindings,cases:cases.map(({name,x,z})=>({name,x,z})),totalSamples:cases.length*3*24,changedSamples:rows.length,maxChangeDegrees:Math.max(0,...rows.map(r=>r.changeDegrees)),rows,productionChanged:false,fullGoalComplete:false,limits:['Production solver with terrain and exact nearby landmark boxes; excludes resource/building obstacles, interpolation and rendered frames.','These are deliberate offline angle samples, not normal browser inputs or a performance/quality pass.','scene.draw writes resolvedYaw to view.yaw; main reads view.yaw for compass and next gesture, so this diagnostic identifies intent overwrite, not a complete fix.'],next:'Keep manual requested yaw separate from collision orbit; compare retraction/elevation/temporary orbit strategies in the existing isolated continuous camera QA before changing production. Preserve visibility/collision tests and ordinary completed save; no starter/main-path replay.'};
fs.writeFileSync(new URL('docs/camera-intent-diagnostic.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:report.totalSamples,changed:rows.length,maxChangeDegrees:report.maxChangeDegrees,productionChanged:false}));
