// Actual production core in headless declared fixtures; never read or write a browser save.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createWorld,terrain} from '../src/world.js';
import {freshGame,movePlayer,nearest,interact,resolveGather,isDepleted,canBuild,serialize,restore} from '../src/game.js';
import {registerFootprint,footprintBlocksMove,footprintGatherTarget,footprintIntersectsBuilding} from '../src/resource-footprint.js';
import {resourceReachDistance} from '../src/resource-contact.js';
import {GATHER_RANGE,GATHER_IMPACT} from '../src/action-timing.js';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'dist/inland-authored-contact-candidate'),bytes=await fs.readFile(path.join(folder,'inland-contact-shapes.json')),data=JSON.parse(bytes),preparation=JSON.parse(await fs.readFile(path.join(root,'docs/inland-contact-cell-preparation.json'))),sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(bytes),preparation.sha256);
for(const [file,hash]of Object.entries(data.sourceHashes))assert.equal(sha(await fs.readFile(path.join(root,file))),hash);
const contact=JSON.parse(await fs.readFile(path.join(folder,'wood-contact-cells.json'))),surface=JSON.parse(await fs.readFile(path.join(folder,'wood-surface-cells.json'))),surfaceKeys=new Set(surface.cells.map(c=>c.join(','))),newInterior=contact.cells.filter(c=>!surfaceKeys.has(c.join(','))),sourceKeys=new Set(contact.cells.map(c=>c.join(',')));
function coverage(boxes){const keys=new Set();for(const [min,max]of boxes){const lo=min.map(v=>Math.round(v/.2)),hi=max.map(v=>Math.round(v/.2));for(let x=lo[0];x<hi[0];x++)for(let y=lo[1];y<hi[1];y++)for(let z=lo[2];z<hi[2];z++)keys.add(`${x},${y},${z}`);}return keys;}
const bodyCoverage=coverage(data.bodyBoxes),cameraCoverage=coverage(data.cameraBoxes);for(const key of sourceKeys){assert(bodyCoverage.has(key));assert(cameraCoverage.has(key));}for(const key of bodyCoverage)if(Number(key.split(',')[1])<16)assert(sourceKeys.has(key));
const world=createWorld(),before=JSON.stringify(world.objects),frames=new Map();for(const row of data.placements){const node=world.objects.find(o=>o.id===row.id);assert.deepEqual([node.x,node.y,node.z,node.scale,node.rotation],row.pose);registerFootprint(node,data.bodyBoxes,terrain,row.frame);frames.set(row.id,row.frame);}
const seed=p=>{const s=freshGame();Object.assign(s.player,p);s.time=240;s.quest=6;s.inventory.axe=1;s.selected='axe';return s;},advance=(s,objects,axis,frames=18)=>{const start={x:s.player.x,z:s.player.z};for(let i=0;i<frames;i++)movePlayer(s,objects,axis.x,axis.z,1/60);return Math.hypot(s.player.x-start.x,s.player.z-start.z);};
const inside=(p,node)=>{const f=frames.get(node.id),c=Math.cos(f.rotation),s=Math.sin(f.rotation),x=(c*(p.x-f.x)-s*(p.z-f.z))/f.scale,z=(s*(p.x-f.x)+c*(p.z-f.z))/f.scale,y=(terrain(p.x,p.z)-f.y)/f.scale,r=.35/f.scale;return data.bodyBoxes.some(([a,b])=>b[1]>y+.02&&a[1]<y+2.95/f.scale&&x>a[0]-r&&x<b[0]+r&&z>a[2]-r&&z<b[2]+r);};
const toWorld=(cell,frame)=>{const x=(cell[0]+.5)*.2,z=(cell[2]+.5)*.2,c=Math.cos(frame.rotation),s=Math.sin(frame.rotation);return {x:frame.x+frame.scale*(c*x+s*z),z:frame.z+frame.scale*(-s*x+c*z)};};
if(process.argv.includes('--native-overlap')){
 const observations=JSON.parse(await fs.readFile(path.join(root,'docs/inland-contact-native-observations.json'))),node=world.objects.find(o=>o.id==='resource-1765'),labels=['overlap-reloaded','overlap-native-escape','overlap-native-side-exit','overlap-native-forward-exit'],checks=labels.map(label=>{const row=observations.find(r=>r.label===label);assert(row);return {label,player:row.player,insideRegisteredWood:inside(row.player,node)};});
 assert(checks[0].insideRegisteredWood);assert(checks[1].insideRegisteredWood);assert(checks[2].insideRegisteredWood);assert(!checks.at(-1).insideRegisteredWood);assert.equal(JSON.stringify(world.objects),before);
 const report={verified:true,scope:'Actual native observations against unchanged production terrain and registered candidate footprint. First A/S routes remain overlapped; subsequent W route leaves wood with full world objects active.',checks,worldObjectsUnchanged:true,ordinarySaveTouched:false};await fs.writeFile(path.join(root,'docs/inland-contact-native-overlap-probe.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exit(0);
}
const rows=[];
for(const row of data.placements){
 const node=world.objects.find(o=>o.id===row.id);let result=null;
 search:for(let j=0;j<24;j++){const angle=j*Math.PI/12;for(let radius=12;radius>=.5;radius-=.25){
  const p={x:node.x+Math.sin(angle)*radius,z:node.z+Math.cos(angle)*radius};if(terrain(p.x,p.z)<.15)continue;const reach=resourceReachDistance(p,node),distance=reach-GATHER_RANGE+1.2;if(distance<.45||distance>1.05)continue;
  const base=seed(p);if(nearest(base,world.objects)?.id!==node.id)continue;const target=footprintGatherTarget(p,node);if(!target)continue;
  for(const axis of [{x:Math.sign(target.x-p.x),z:0},{x:0,z:Math.sign(target.z-p.z)}]){
   if(!axis.x&&!axis.z||!footprintBlocksMove(p,{x:p.x+axis.x*2,z:p.z+axis.z*2},node))continue;
   const gather=restore(serialize(base)),pending=interact(gather,node,{defer:true});if(!pending?.pending)continue;gather.time+=GATHER_IMPACT+.001;const message=resolveGather(gather,pending.pending);if(gather.inventory.wood!==3||!isDepleted(gather,node))continue;
   const blocked=restore(serialize(base)),walked=restore(serialize(gather)),blockedDistance=advance(blocked,world.objects,axis),afterDistance=advance(walked,world.objects,axis);if(blockedDistance>1.85||afterDistance<2.09)continue;
   const buildState=restore(serialize(gather));Object.assign(buildState.inventory,{wood:30,stone:30,fiber:30});const regrowthBuild=canBuild(buildState,[node],'campfire',p.x,p.z);
   result={id:node.id,start:p,axis,reachableWood:target,reach,blockedDistance,afterGatherDistance:afterDistance,gatherMessage:message,woodAdded:3,depletedUntil:gather.depleted[node.id],regrowthBuild,buildingContact:footprintIntersectsBuilding(node,{type:'campfire',...p})};break search;
  }
 }}
 if(!result){rows.push({id:node.id,failed:'No full-world blocked/gather/pass route found'});continue;}
 let overlap=null;
 for(const cell of newInterior){if(cell[1]>=16)continue;const p=toWorld(cell,row.frame);if(!inside(p,node))continue;const original=seed(p),saved=serialize(original),restored=restore(saved);assert.deepEqual(restored.player,original.player);
  const axes=[{x:Math.sign(p.x-node.x)||1,z:0},{x:0,z:Math.sign(p.z-node.z)||1}];for(const axis of axes){const s=restore(saved),start={...s.player};let frames=0;while(frames<180){movePlayer(s,[node],axis.x,axis.z,1/60);frames++;if(!inside(s.player,node)&&Math.hypot(s.player.x-start.x,s.player.z-start.z)>.5)break;}if(!inside(s.player,node)){overlap={start:p,end:{x:s.player.x,z:s.player.z},axis,frames,distance:Math.hypot(s.player.x-p.x,s.player.z-p.z),savePlayerUnchanged:true,scope:'Single-tree overlap escape fixture using real production movePlayer/restore; no other resource collision claim'};break;}}
  if(overlap)break;
 }
 result.overlap=overlap;
 const legacy=seed(result.start),camp={id:'inland-legacy-'+node.id,type:'campfire',x:result.start.x,z:result.start.z};legacy.buildings=[camp];legacy.player.hp=62;const restored=restore(serialize(legacy));assert.deepEqual(restored.buildings,legacy.buildings);assert.deepEqual(restored.player,legacy.player);result.legacyCampSuppressesTree=isDepleted(restored,node);result.legacyCampRest=interact(restored,camp);result.legacyCampHp=restored.player.hp;rows.push(result);
}
assert.equal(JSON.stringify(world.objects),before);
const failed=rows.filter(r=>r.failed||!r.overlap||!r.legacyCampSuppressesTree||r.legacyCampHp!==100),report={verified:failed.length===0,scope:'Headless declared fresh q6/axe fixtures with unchanged79 enemy records; real core movement/gather/build/serialize/restore. Not browser main path or ordinary progress.',bodyBoxes:data.bodyBoxes.length,cameraBoxes:data.cameraBoxes.length,sourceCellsCovered:sourceKeys.size,fineBasalCoverageExact:true,addedInteriorCells:newInterior.length,rows,regrowthBuildRejections:rows.filter(r=>r.regrowthBuild?.includes('恢复')).length,failed:failed.map(r=>({id:r.id,error:r.failed??(!r.overlap?'overlap escape unverified':'legacy camp unverified')})),worldObjectsUnchanged:true,ordinarySaveTouched:false,nativeMainPathAccepted:false,productionIntegrated:false,fullGoalComplete:false};
await fs.writeFile(path.join(root,'docs/inland-contact-core-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({verified:report.verified,resources:rows.length,regrowthBuildRejections:report.regrowthBuildRejections,failed:report.failed,example:rows.find(r=>r.id==='resource-1765')}));if(failed.length)process.exitCode=1;
