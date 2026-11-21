import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const profileRoute=process.env.TIDELANDS_ROUTE_PROFILE==='1';
export const routeViewport=width=>profileRoute ?
  {viewport:width===390?{width:390,height:844}:{width:1920,height:1080},deviceScaleFactor:width===390?1.5:1} :
  {viewport:{width,height:width===390?844:800}};

const observer=`
import {installJourneyProbe} from '/tools/journey_frame_probe.js';
const nativeDraw=WorldView.prototype.draw,nativeSync=WorldView.prototype.sync;
let routeActive=false,syncRows=[],warmup=null;
const nativeWarm=WorldView.prototype.warmInlandTree;
if(nativeWarm)WorldView.prototype.warmInlandTree=function(...args){
  const start=performance.now(),before={...this.renderer.info.memory};
  try{return nativeWarm.apply(this,args);}
  finally{warmup={ms:performance.now()-start,before,after:{...this.renderer.info.memory}};}
};
WorldView.prototype.draw=function(...args){
  this.routeTiming??=installJourneyProbe(this,window.__journeySink);
  return this.routeTiming.draw(()=>nativeDraw.apply(this,args),args[0],args[3],args[4]);
};
WorldView.prototype.sync=function(state){
  if(!routeActive)return nativeSync.apply(this,arguments);
  const start=performance.now();
  try{return nativeSync.apply(this,arguments);}
  finally{
    if(syncRows.length>=1800)throw Error('Route sync sample budget exhausted');
    syncRows.push({wall:start,time:state.time,ms:performance.now()-start});
  }
};
window.routeProfile={
  start(){syncRows=[];routeActive=true;window.journeyProbe.start();},
  async stop(){
    routeActive=false;
    return {timing:await window.journeyProbe.stop(),sync:syncRows,warmup,
      longFrames:performance.getEntriesByType('long-animation-frame').map(e=>({wall:e.startTime,ms:e.duration,blocking:e.blockingDuration,renderStart:e.renderStart}))};
  }
};`;

export async function routeRequests(context,origin,root,dir){
  if(profileRoute)await context.exposeBinding('__journeySink',(_source,batch)=>{
    fs.appendFileSync(path.join(dir,'frames.jsonl'),JSON.stringify(batch)+'\n');
  });
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(profileRoute&&url.pathname===`/${root}/src/scene.js`){
      const source=fs.readFileSync(`${root}/src/scene.js`,'utf8');
      return route.fulfill({contentType:'application/javascript',body:source+'\n'+observer});
    }
    return route.continue();
  });
}

export async function startRouteProfile(page){
  if(profileRoute)await page.evaluate(()=>window.routeProfile.start());
}

export async function stopRouteProfile(page,dir){
  if(!profileRoute)return null;
  const data=await page.evaluate(()=>window.routeProfile.stop());
  for(const file of ['journey_frame_probe.js','runtime_budget_probe.js']){
    const source=fs.readFileSync(new URL(file,import.meta.url));
    data[file+'Sha256']=createHash('sha256').update(source).digest('hex');
  }
  fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify(data,null,2)+'\n');
  const {timing}=data;
  assert(timing.supported&&timing.completed>15);
  assert.equal(timing.dropped,0);
  assert.equal(timing.hiddenFrames,0);
  assert.equal(timing.contextLost,false);
  assert.equal(timing.disjointFrames,0);
  assert.equal(timing.timeouts,0);
  assert.equal(timing.issued,timing.deleted);
  assert.deepEqual(timing.errors,[]);
  return timing;
}
