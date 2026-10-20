// Offline probe of a proposed highland shape. Does not change production terrain or saves.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as live from '../src/world.js';

const sha=data=>createHash('sha256').update(data).digest('hex');
const currentSource=fs.readFileSync(new URL('../src/world.js',import.meta.url),'utf8');
const source=execFileSync('git',['show','e33da35:src/world.js'],{encoding:'utf8',cwd:new URL('..',import.meta.url)});
const marker='  return value;\n}';
assert.equal(source.split(marker).length,2,'Terrain return must be unique for this isolated probe');
// Two shoulders and a central saddle: a shape proposal, not final art or a runtime implementation.
const deformation=`
  const u=(x+75)/65,v=(z+235)/65;
  const window=Math.max(0,1-(u*u+v*v));
  const ridge=8*Math.exp(-((u+.38)**2*11+(v-.12)**2*4))
    +6*Math.exp(-((u-.4)**2*13+(v+.28)**2*5))
    -12*Math.exp(-(u*u*9+v*v*5));
  return value+window*window*ridge;
}`;
const proposed=await import('data:text/javascript;base64,'+Buffer.from(source.replace(marker,deformation)).toString('base64'));
const before=live.createWorld(),after=proposed.createWorld();
const fixed=await import('data:text/javascript;base64,'+Buffer.from(currentSource.replace('export function terrain(x,z){','function originalTerrain(x,z){')+'\nexport function terrain(x,z){const value=originalTerrain(x,z);'+deformation).toString('base64'));
const resourceIdentity=o=>[o.id,o.type,o.x,o.z,o.scale,o.rotation];
const enemyIdentity=o=>[o.id,o.type,o.x,o.z,o.hp,o.homeX,o.homeZ];
const identities=world=>({resources:world.objects.map(resourceIdentity),enemies:world.enemies.map(enemyIdentity)});
const baseline=identities(before),candidate=identities(after);
assert.deepEqual(identities(fixed.createWorld()),baseline,'Separated placement sampling must preserve all identities');
const changes=(a,b)=>{
  const left=new Map(a.map(row=>[row[0],row])),right=new Map(b.map(row=>[row[0],row]));
  return [...new Set([...left.keys(),...right.keys()])].filter(id=>JSON.stringify(left.get(id))!==JSON.stringify(right.get(id)))
    .map(id=>({id,before:left.get(id)??null,after:right.get(id)??null}));
};
const changedResources=changes(baseline.resources,candidate.resources),changedEnemies=changes(baseline.enemies,candidate.enemies);
const outsideHighland=changedResources.filter(row=>[row.before,row.after].some(r=>r&&Math.hypot(r[2]+75,r[3]+235)>100));
const sample=(fn,x,z)=>({height:fn(x,z),slope:Math.hypot(fn(x+.5,z)-fn(x-.5,z),fn(x,z+.5)-fn(x,z-.5))});
const profile=[];
for(let x=-135;x<=-15;x+=5)profile.push({x,z:-235,before:sample(live.terrain,x,-235),candidate:sample(proposed.terrain,x,-235)});
let maxDelta=0,changedWaterClass=0;
for(let x=-175;x<=25;x+=2.5)for(let z=-335;z<=-135;z+=2.5){
  const a=live.terrain(x,z),b=proposed.terrain(x,z);maxDelta=Math.max(maxDelta,Math.abs(a-b));changedWaterClass+=Number((a<.15)!==(b<.15));
}
const ordinary=JSON.parse(fs.readFileSync(new URL('../docs/beacon-footing-normal-save.json',import.meta.url),'utf8'));
const anchors=[...live.LANDMARKS.map(o=>({id:o.id,x:o.x,z:o.z})),{id:'spawn',...live.SPAWN},
  {id:'ordinary-player',x:ordinary.player.x,z:ordinary.player.z},
  ...ordinary.buildings.map(o=>({id:o.id,x:o.x,z:o.z}))];
const anchorSamples=anchors.map(o=>({...o,before:sample(live.terrain,o.x,o.z),candidate:sample(proposed.terrain,o.x,o.z)}));
const report={worldSourceSha256:sha(source),currentWorldSourceSha256:sha(currentSource),baselineReference:'e33da35:src/world.js',fixedCandidateIdentityMatches:true,productionWorldSha256:sha(JSON.stringify(before)),
  baselineIdentitySha256:sha(JSON.stringify(baseline)),candidateIdentitySha256:sha(JSON.stringify(candidate)),
  baselineCounts:{resources:before.objects.length,enemies:before.enemies.length},candidateCounts:{resources:after.objects.length,enemies:after.enemies.length},
  changedResourceIdentityCount:changedResources.length,changedEnemyIdentityCount:changedEnemies.length,
  changedResourceIdentitiesOutsideHighland:outsideHighland.length,changedResources,changedEnemies,profile,anchorSamples,
  maxHeightDelta:maxDelta,changedWaterClassSamples:changedWaterClass,sampledPoints:81*81,
  productionAdopted:false,ordinarySaveModified:false,renderedSuitabilityVerified:false,
  scope:'Offline proposed height field only; demonstrates generation/save-identity coupling. No rendering, path acceptance, final silhouette, asset acquisition, GPU or M5 acceptance.'};
assert(maxDelta>1,'Probe must actually change the proposed height field');
assert.equal(changedWaterClass,0,'This interior-only proposal must preserve water classification on the sampled grid');
assert(changedResources.length>0,'Probe must expose actual identity coupling rather than assume compatibility');
assert.equal(sha(fs.readFileSync(new URL('../src/world.js',import.meta.url))),sha(currentSource));
fs.writeFileSync(new URL('../docs/landform-compatibility-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(new URL('../docs/landform-identity-baseline.json',import.meta.url),JSON.stringify({worldSourceSha256:sha(source),identitySha256:report.baselineIdentitySha256,...baseline},null,2)+'\n');
console.log(JSON.stringify({resources:before.objects.length,enemies:before.enemies.length,changedResources:changedResources.length,changedOutsideHighland:outsideHighland.length,changedEnemies:changedEnemies.length,maxDelta,changedWaterClass,productionAdopted:false}));
