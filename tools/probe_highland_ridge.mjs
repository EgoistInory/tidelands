import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as world from '../src/world.js';
import {createMeadow} from '../src/meadow.js';

const sha=data=>createHash('sha256').update(data).digest('hex');
const reference='67b9cc5',oldSource=execFileSync('git',['show',reference+':src/world.js'],{encoding:'utf8'});
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const oldWorld=await import(dataUrl(oldSource));
const oldMeadowSource=execFileSync('git',['show',reference+':src/meadow.js'],{encoding:'utf8'})
  .replace("'./world.js'",JSON.stringify(dataUrl(oldSource)))
  .replace("'../vendor/three.module.min.js'",JSON.stringify(new URL('../vendor/three.module.min.js',import.meta.url).href));
const oldMeadow=await import(dataUrl(oldMeadowSource));
const before=oldWorld.createWorld(),current=world.createWorld();
const identities=w=>({objects:w.objects.map(({y,...o})=>o),enemies:w.enemies});
assert.deepEqual(identities(before),identities(current));
const plantRows=batches=>{
  const outside=[],counts={};
  for(const b of batches){counts[b.name]=(counts[b.name]??0)+b.count;
    for(let i=0;i<b.count;i++){
      const matrix=Array.from(b.instanceMatrix.array.subarray(i*16,i*16+16));
      if(Math.hypot(matrix[12]+75,matrix[14]+235)<65.001)continue;
      const color=b.instanceColor?Array.from(b.instanceColor.array.subarray(i*3,i*3+3)):[];
      outside.push([b.name,...matrix,...color]);
    }
  }
  outside.sort((a,b)=>a[0].localeCompare(b[0])||a[13]-b[13]||a[15]-b[15]);
  return {outsideCount:outside.length,outsideSha256:sha(JSON.stringify(outside)),counts};
};
const oldPlants=plantRows(oldMeadow.createMeadow(oldWorld.randomGenerator(4321),before.objects));
const newPlants=plantRows(createMeadow(world.randomGenerator(4321),current.objects));
assert.equal(newPlants.outsideCount,oldPlants.outsideCount);
assert.equal(newPlants.outsideSha256,oldPlants.outsideSha256);
let maxDelta=0,maxGradient=0,maxRiseAt30fps=0,changedWater=0,minInterior=Infinity;
const delta=(x,z)=>world.terrain(x,z)-oldWorld.terrain(x,z);
for(let x=-140;x<=-10;x++)for(let z=-300;z<=-170;z++){
  const h=world.terrain(x,z);maxDelta=Math.max(maxDelta,Math.abs(delta(x,z)));
  maxGradient=Math.max(maxGradient,Math.hypot(delta(x+.5,z)-delta(x-.5,z),delta(x,z+.5)-delta(x,z-.5)));
  for(const [dx,dz]of[[.4,0],[-.4,0],[0,.4],[0,-.4]])maxRiseAt30fps=Math.max(maxRiseAt30fps,world.terrain(x+dx,z+dz)-h);
  changedWater+=Number((h<.15)!==(oldWorld.terrain(x,z)<.15));
  if(Math.hypot(x+75,z+235)<65)minInterior=Math.min(minInterior,h);
}
assert.equal(changedWater,0);assert(maxGradient<1&&maxRiseAt30fps<1.9);
const sources=Object.fromEntries(fs.readdirSync('src').filter(f=>f.endsWith('.js')).sort().map(f=>['src/'+f,sha(fs.readFileSync('src/'+f))]));
const report={reference,sources,identitiesPreserved:true,counts:{resources:current.objects.length,enemies:current.enemies.length},
  changedResourceHeights:current.objects.filter((o,i)=>Math.abs(o.y-before.objects[i].y)>1e-9).length,
  oldPlants,newPlants,oldWorldSha256:sha(JSON.stringify(before)),currentWorldSha256:sha(JSON.stringify(current)),
  sampledPoints:131*131,maxHeightDelta:maxDelta,maxDeltaGradient:maxGradient,maxRiseAt30fps,minInterior,changedWater,
  landmarkHeights:world.LANDMARKS.map(o=>({id:o.id,before:oldWorld.terrain(o.x,o.z),current:world.terrain(o.x,o.z)})),
  renderedSuitabilityVerified:false,fullGoalComplete:false,
  scope:'CPU identity/plant placement/height checks only. 0.4m cardinal steps sample a 30fps sprint bound; this is not a real mainline route, GPU, physical device, audio or M5 acceptance.'};
fs.writeFileSync('docs/highland-ridge-cpu.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({resources:current.objects.length,enemies:current.enemies.length,changedHeights:report.changedResourceHeights,outsidePlants:newPlants.outsideCount,maxDelta,maxGradient,maxRiseAt30fps,changedWater}));
