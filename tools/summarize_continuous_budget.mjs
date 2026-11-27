import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {terrain,dayCycle} from '../src/world.js';

const [directory,output]=process.argv.slice(2);
assert(directory&&output&&!fs.existsSync(output));
const read=file=>fs.readFileSync(path.join(directory,file));
const raw=JSON.parse(read('raw.json')),profile=JSON.parse(read('profile.json'));
assert(raw.complete&&raw.reloadExact&&raw.exportExact&&!raw.logs.length&&raw.respawns===0);
const frameBytes=read('frames.jsonl');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const batches=frameBytes.toString().trim().split('\n').map(JSON.parse);
const frames=batches.flatMap(b=>b.frames),gpu=batches.flatMap(b=>b.gpu),resources=batches.flatMap(b=>b.resources);
assert.equal(frames.length,profile.timing.frames);assert.equal(gpu.length,profile.timing.completed);
assert(frames.every(row=>row[12]===4)&&resources.every(row=>row.glError===0||(row.glError===null&&profile.glError===0)));
const minimumDuration=raw.returnOnly?10000:600000;
if(raw.returnOnly)assert.deepEqual(raw.phases.map(p=>p.name),['00-shoal-import','01-coast-return','02-original-camp']);
assert(frameBytes.length&&raw.stoppedWall-raw.startedWall>=minimumDuration);
const rounded=n=>+n.toFixed(3);
const metric=values=>{
  const a=values.filter(Number.isFinite).sort((u,v)=>u-v);
  if(!a.length)return null;
  const p=f=>rounded(a[Math.ceil(f*a.length)-1]);
  return {n:a.length,median:p(.5),p95:p(.95),p99:p(.99),max:p(1)};
};
const byFrame=new Map(gpu.map(sample=>[sample.frame,sample.ms]));
function stageFor(frame,previous){
  return profile.stages.find(r=>Math.abs(r.current.drawStart-frame[1])<1&&Math.abs(r.previous.drawStart-previous[1])<1);
}
const spikes=[];
for(let i=1;i<frames.length;i++){
  const f=frames[i],p=frames[i-1];
  if(f[7]<=50)continue;
  const m=stageFor(f,p);
  const costs=m?{
    previousDraw:rounded(m.previous.drawEnd-m.previous.drawStart),
    previousAfterDraw:rounded(m.previous.end-m.previous.drawEnd),
    outsideCallback:rounded(m.current.begin-m.previous.end),
    currentBeforeDraw:rounded(m.current.drawStart-m.current.begin)
  }:null;
  const overlap=profile.longFrames.filter(l=>l.wall<f[1]&&l.wall+l.ms>p[1]);
  spikes.push({frame:i,time:f[2],x:f[3],z:f[4],elevation:terrain(f[3],f[4]),intervalMs:rounded(f[7]),
    previousDrawCpuMs:rounded(p[8]),previousRendererCpuMs:rounded(p[9]),previousGpuMs:byFrame.get(p[0])??null,
    costs,longAnimationFrames:overlap,nearCheckpoint:raw.phases.find(p=>Math.abs(p.time-f[2])<.5)?.name??null});
}
let traveled=0,maxTurn=0,turnOver45=0,waterFrames=0;
const lighting=new Set();
for(let i=1;i<frames.length;i++){
  const f=frames[i],p=frames[i-1];
  traveled+=Math.hypot(f[3]-p[3],f[4]-p[4]);
  if(terrain(f[3],f[4])<0)waterFrames++;
  lighting.add(dayCycle(f[2]).label);
  const a=Math.atan2(f[13]-f[3],f[15]-f[4]),b=Math.atan2(p[13]-p[3],p[15]-p[4]);
  const angle=Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))*180/Math.PI;
  maxTurn=Math.max(maxTurn,angle);
  if(angle>45)turnOver45++;
}
const phases=raw.phases.map(p=>({name:p.name,imageSha256:p.imageSha256,saveSha256:p.saveSha256,
  time:p.time,cycle:dayCycle(p.time),player:p.player,elevation:terrain(p.player.x,p.player.z),kills:p.kills,
  wood:p.inventory.wood,crystal:p.inventory.crystal,berry:p.inventory.berry,shell:p.inventory.shell}));
// Phase boundaries use the local save clock, so they can be compared with the rendered sample clock.
const legs=[];
let first=0;
for(const end of [...phases,{name:'profile-stop',time:Infinity}]){
  let last=first;
  while(last<frames.length&&frames[last][2]<=end.time)last++;
  if(last===first)continue;
  const samples=frames.slice(first,last);
  legs.push({
    endingAt:end.name,frames:samples.length,gpuMs:metric(samples.map(frame=>byFrame.get(frame[0]))),
    intervalMs:metric(samples.map(frame=>frame[7])),
    spikes:spikes.filter(spike=>spike.frame>=first&&spike.frame<last).length
  });
  first=last;
}
const timing=profile.timing, matched=spikes.filter(s=>s.costs);
const returnFrames=raw.returnOnly?frames.filter(f=>Math.hypot(f[3]+66.29146,f[4]-96.59255)<8):[];
const summary={
  archiveSha256:raw.packageSha256,framesSha256:sha(frameBytes),frameProfileSha256:sha(read('profile.json')),
  runnerSha256:raw.runnerSha256,startingSaveSha256:raw.initialSaveSha256,
  finalSaveSha256:sha(read('final-save.json')),exportSha256:sha(read('restored-live-export.json')),
  buffer:resources[0].buffer,wallSeconds:(raw.stoppedWall-raw.startedWall)/1000,displayedSeconds:rounded((frames.at(-1)[1]-frames[0][1])/1000),
  frames:frames.length,moving:frames.filter(f=>f[6]).length,distance:rounded(traveled),waterFrames,lighting:[...lighting],timing,
  gpuMs:metric(gpu.map(g=>g.ms)),intervalMs:metric(frames.map(f=>f[7])),drawCpuMs:metric(frames.map(f=>f[8])),
  syncCpuMs:metric(profile.sync.map(a=>a.ms)),turn:{maxDegrees:rounded(maxTurn),over45:turnOver45},
  spikeCount:spikes.length,matchedStages:matched.length,stageLimitReached:profile.stages.length>=600,
  outsideCallbackMajority:matched.filter(s=>s.costs.outsideCallback>s.intervalMs/2).length,
  observedLongAnimationFrames:profile.longFrames.length,
  spikes:spikes.sort((a,b)=>b.intervalMs-a.intervalMs).slice(0,12),
  resourceSamples:{first:resources[0],last:resources.at(-1),max:Object.fromEntries(['geometries','textures','programs'].map(k=>[k,Math.max(...resources.map(a=>a[k]))]))},
  usedHeapBytes:raw.heap.map(a=>a.usedSize),phases,legs,
  ...(raw.returnOnly?{returnOnly:true,priorStallArea:{radius:8,drawCpuMs:metric(returnFrames.map(f=>f[8])),
    intervalMs:metric(returnFrames.map(f=>f[7]))}}:{}),
  scope:'Actual native keys and clock, production rendering and save format. Main/scene only carry time observers. Unassigned gaps can include host/browser scheduling. JS heap and renderer object counts are not VRAM.'
};
fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({frames:summary.frames,seconds:summary.displayedSeconds,gpu:summary.gpuMs,interval:summary.intervalMs,
  over50:summary.spikeCount,matched:summary.matchedStages,outsideCallbackMajority:summary.outsideCallbackMajority,turn:summary.turn}));
