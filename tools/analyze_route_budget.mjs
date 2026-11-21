import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {terrain} from '../src/world.js';

const [output,...sources]=process.argv.slice(2);
assert(output&&sources.length&&!fs.existsSync(output));
const sha=data=>createHash('sha256').update(data).digest('hex');
const layouts=JSON.parse(fs.readFileSync('assets/inland/inland-contact-shapes.json'));
const {pose:tree}=layouts.placements.find(p=>p.id==='resource-7');
const round=n=>Number(n.toFixed(3));
function summary(values){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const p=n=>round(a[Math.ceil(a.length*n)-1]);
  return {n:a.length,median:p(.5),p95:p(.95),max:p(1)};
}
const results=[];
for(const source of sources){
  const report=JSON.parse(fs.readFileSync(path.join(source,'report.json')));
  assert(report.complete&&report.rows.length===2&&!report.logs.length,source);
  const route=source.endsWith('-night')?'night':'highland';
  for(const row of report.rows){
    const dir=path.join(source,String(row.width)),raw=fs.readFileSync(path.join(dir,'frames.jsonl'));
    const batches=raw.toString().trim().split('\n').map(JSON.parse);
    const frames=batches.flatMap(b=>b.frames),gpu=batches.flatMap(b=>b.gpu),resources=batches.flatMap(b=>b.resources);
    const profile=JSON.parse(fs.readFileSync(path.join(dir,'profile.json')));
    assert.equal(frames.length,profile.timing.frames);
    assert.equal(gpu.length,profile.timing.completed);
    assert(resources.length&&resources.every(r=>r.glError===0));
    assert(frames.every(f=>f[12]===4),'All timings must cover four passes');
    const phase=f=>route==='highland'?(f[2]<row.phases[1].time?'downhill':'ascent'):
      (terrain(f[3],f[4])<.15?'water':f[2]<row.phases[1].time?'forest':f[2]<row.phases[2].time?'shore':'camp');
    const groups=new Map();
    for(const f of frames){
      const name=phase(f);
      if(!groups.has(name))groups.set(name,{frames:[],gpu:[]});
      groups.get(name).frames.push(f);
    }
    for(const g of gpu)groups.get(phase(frames[g.frame])).gpu.push(g.ms);
    const phases=Object.fromEntries([...groups].map(([name,{frames,gpu}])=>[name,{
      frames:frames.length,moving:frames.filter(f=>f[6]).length,
      intervalMs:summary(frames.map(f=>f[7])),drawCpuMs:summary(frames.map(f=>f[8])),gpuMs:summary(gpu)
    }]));
    const worst=frames.slice(1).sort((a,b)=>b[7]-a[7]).slice(0,6).map(f=>{
      const p=frames[f[0]-1];
      return {frame:f[0],phase:phase(f),x:round(f[3]),z:round(f[4]),time:round(f[2]),interval:round(f[7]),
        previousDraw:round(p[8]),previousRender:round(p[9]),sampledPreviousGpu:gpu.find(g=>g.frame===p[0])?.ms??null,
        syncMs:round(profile.sync.filter(s=>s.wall>=p[1]&&s.wall<f[1]).reduce((sum,s)=>sum+s.ms,0))};
    });
    let nearTree=null;
    if(route==='night'){
      const distance=f=>Math.hypot(f[3]-tree[0],f[4]-tree[2]);
      const entry=frames.findIndex((f,i)=>i>0&&distance(f)<12&&distance(frames[i-1])>=12);
      assert(entry>=4,'Expected the actual route to cross the near-tree boundary');
      const window=frames.slice(entry-4,entry+7),most=window.reduce((m,f)=>f[8]>m[8]?f:m);
      nearTree={entryFrame:entry,treeId:'resource-7',x:round(frames[entry][3]),z:round(frames[entry][4]),
        highestInterval:summary(window.map(f=>f[7])).max,highestDraw:round(most[8]),associatedRender:round(most[9]),
        lastResources:resources.findLast(r=>r.frame<entry),nextResources:resources.find(r=>r.frame>entry)};
    }
    results.push({
      source:path.basename(source),route,assetSha256:report.archiveSha256,framesSha256:sha(raw),
      buffer:resources[0].buffer,frames:frames.length,seconds:round((frames.at(-1)[1]-frames[0][1])/1000),
      syncMs:summary(profile.sync.map(s=>s.ms)),intervalMs:summary(frames.map(f=>f[7])),drawCpuMs:summary(frames.map(f=>f[8])),
      gpuMs:summary(gpu.map(g=>g.ms)),over50:frames.filter(f=>f[7]>50).length,over33:frames.filter(f=>f[7]>33.33).length,
      warmup:profile.warmup??null,initialTextures:resources[0].textures,finalTextures:resources.at(-1).textures,
      peakDrawCalls:Math.max(...frames.map(f=>f[10])),phases,nearTree,worst
    });
  }
}
fs.writeFileSync(output,JSON.stringify({scope:'Real native Metal Chromium frame observations. GPU samples cover all four passes. Unknown residual is not counted as CPU or GPU attribution. No device or long soak claim.',results},null,2)+'\n');
for(const r of results)console.log(JSON.stringify({source:r.source,buffer:r.buffer,frames:r.frames,gpu95:r.gpuMs.p95,raf95:r.intervalMs.p95,max:r.intervalMs.max,over50:r.over50,tree:r.nearTree?.highestInterval}));
