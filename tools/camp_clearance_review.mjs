import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMeadow,updateCampClearance} from '../src/meadow.js';
import {createWorld,randomGenerator} from '../src/world.js';

const root=path.resolve(import.meta.dirname,'..'),hash=data=>createHash('sha256').update(data).digest('hex');
const batches=createMeadow(randomGenerator(4321),createWorld().objects),before=batches.map(b=>hash(Buffer.from(b.instanceMatrix.array.buffer)));
const versions=batches.map(b=>b.instanceMatrix.version),timings=[];
for(const type of ['tent','workbench','campfire']){
  const camps=[{id:'same',type,x:-74,z:105}],start=performance.now(),changed=updateCampClearance(batches,camps),end=performance.now();
  const hidden=batches.reduce((n,b)=>n+(b.userData.campHidden?.size??0),0),cachedStart=performance.now();
  const cachedVersions=batches.map(b=>b.instanceMatrix.version);
  for(let i=0;i<1000;i++)assert.equal(updateCampClearance(batches,camps),0);
  assert.deepEqual(batches.map(b=>b.instanceMatrix.version),cachedVersions);
  timings.push({type,changed,hidden,updateCpuMs:end-start,cached1000CpuMs:performance.now()-cachedStart,
    savedMatrixBytes:hidden*16*4});
}
updateCampClearance(batches,[]);assert.deepEqual(batches.map(b=>hash(Buffer.from(b.instanceMatrix.array.buffer))),before);
assert.ok(batches.every(b=>b.userData.campHidden.size===0));
const camps=Array.from({length:499},(_,i)=>({type:'tent',x:350+(i%10)*2,z:350+Math.floor(i/10)*.5}));camps.push({type:'tent',x:-74,z:105});
const start=performance.now();updateCampClearance(batches,camps);const tail500CpuMs=performance.now()-start;
assert.equal(batches.reduce((n,b)=>n+b.userData.campHidden.size,0),timings[0].hidden);
updateCampClearance(batches,[]);assert.deepEqual(batches.map(b=>hash(Buffer.from(b.instanceMatrix.array.buffer))),before);
const report={passed:true,batches:batches.length,instances:batches.reduce((n,b)=>n+b.count,0),timings,tail500CpuMs,tail500Hidden:timings[0].hidden,
  exactMatricesRestored:true,unchangedBuffersSkipUploads:true,fullGoalComplete:false,
  note:'Node CPU timings and raw saved matrix bytes; not browser/GPU/device/whole-world performance. Geometry, textures and shaders are reused.',
  sourceSha256:Object.fromEntries(['src/meadow.js','src/scene.js','tests/camp-clearance.test.js','tests/camp-clearance.html','tests/camp-clearance-build.html'].map(n=>[n,hash(fs.readFileSync(path.join(root,n)))]))};
fs.writeFileSync(path.join(root,'docs/camp-clearance-numerical.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
