export const GPU_ABLATIONS=['baseline','reuseShadow','noGround','noWater','noSky','noDressing','noTrees'];
export function createGpuAblation(view){
 const groups={noGround:view.scene.children.filter(o=>o.geometry?.attributes.groundLayers),noWater:[view.water],noSky:[view.sky],noDressing:[...view.meadow,view.woodlandDressing?.root],noTrees:[...view.batches.filter(r=>r.entries[0]?.type==='tree').map(r=>r.batch),...(view.coastal?.trees??[]).map(t=>t.root),...(view.coastal?.farBatches??[]),...(view.inland?.trees??[]).map(t=>t.root)]};
 return (mode,render)=>{if(!GPU_ABLATIONS.includes(mode))throw Error('Unknown diagnostic render mask');const nodes=[...new Set((groups[mode]??[]).filter(Boolean))],saved=nodes.map(n=>n.visible),shadow=view.renderer.shadowMap,auto=shadow.autoUpdate,update=shadow.needsUpdate;
  try{nodes.forEach(n=>n.visible=false);if(mode==='reuseShadow'){shadow.autoUpdate=false;shadow.needsUpdate=false;}return render();}
  finally{nodes.forEach((n,i)=>n.visible=saved[i]);shadow.autoUpdate=auto;shadow.needsUpdate=update;}
 };
}
export function installMainGpuAttribution(view,mirror,{orbit=false}={}){
 const gl=view.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),native=view.renderer.render.bind(view.renderer),apply=createGpuAblation(view),button=mirror.querySelector('#sample'),out=mirror.querySelector('#gpu-result'),status=mirror.querySelector('#status');let run=null,lastTime=0,active=null;
 const summarize=values=>{const a=[...values].sort((a,b)=>a-b);return {samples:a.length,p95:a[Math.floor(a.length*.95)]??null,median:a[Math.floor(a.length*.5)]??null,max:a.at(-1)??null};};
 const snap=s=>({player:{...s.player},inventory:{...s.inventory},time:s.time,camera:view.camera.position.toArray(),viewport:[innerWidth,innerHeight],buffer:[view.canvas.width,view.canvas.height],worldUnchanged:JSON.stringify(view.world.objects)===view.gpuFrozen,authoredCast:!!view.authoredCast,coastal:!!view.coastal,inland:!!view.inland,runtimeBase:document.baseURI,runtimeOutsideBase:performance.getEntriesByType('resource').filter(e=>['/src/','/assets/','/vendor/'].some(p=>e.name.includes(p))&&!e.name.startsWith(document.baseURI)).map(e=>e.name),glError:gl.getError()});
 const finish=(s,error=null)=>{if(!run||run.finished)return;for(const q of run.pending)gl.deleteQuery(q.query);run.pending=[];const groups=Object.fromEntries(GPU_ABLATIONS.map(mode=>{const frames=run.frames.filter(r=>r.mode===mode),gpu=run.gpu.filter(r=>r.mode===mode);return [mode,{gpuMs:summarize(gpu.map(r=>r.ms)),drawCpuMs:summarize(frames.map(r=>r.cpu)),renderCalls:summarize(frames.map(r=>r.calls)),triangles:summarize(frames.map(r=>r.triangles))}];}));out.textContent=JSON.stringify({complete:!error,error,orbit,supported:!!ext,hidden:run.hidden,disjoint:run.disjoint,before:run.before,after:snap(s),frames:run.frames,gpuRaw:run.gpu,groups,scope:'Actual packaged209 main rAF/tick/UI/save with declared stationary q6/zero-HP enemies/berry position and own key. Four-second interleaved warmup plus16-second sample;7 masks in round-robin, native GPU query every other measured render. Masks restore in finally. Removing visible systems and reusing stale shadows are diagnostic ablations, not production quality/performance modes. Costs overlap; do not add differences. No normal campaign, motion/combat, audio/device/VRAM/endurance or final3A proof.'});run.finished=true;button.textContent=error?'归因失败':'归因完成';status.textContent=error||'全部诊断遮罩已恢复';};
 view.renderer.render=(...args)=>{
  if(!active)return native(...args);const {mode,measure,query}=active;
  return apply(mode,()=>{if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);try{return native(...args);}finally{if(query)gl.endQuery(ext.TIME_ELAPSED_EXT);if(measure){active.calls=view.renderer.info.render.calls;active.triangles=view.renderer.info.render.triangles;}}});
 };
 button.disabled=!ext;button.onclick=()=>{if(!ext)return;run={start:null,startTime:lastTime,before:null,startYaw:view.yaw,frames:[],gpu:[],pending:[],hidden:false,disjoint:0,step:0,last:null,finished:false};button.disabled=true;button.textContent='已准备，请继续旅程';status.textContent='4秒预热+16秒交错归因';};
 view.mainGpuAttribution={draw(s,args,draw){
  lastTime=s.time;if(!run||run.finished)return draw();const now=performance.now();if(run.start===null){if(s.time===run.startTime)return draw();run.start=now;run.before=snap(s);}
  try{
   if(document.hidden){run.hidden=true;throw Error('Page hidden during attribution');}if(view.canvas.width!==run.before.buffer[0]||view.canvas.height!==run.before.buffer[1])throw Error('Framebuffer resized during attribution');if(gl.getParameter(ext.GPU_DISJOINT_EXT)){run.disjoint++;throw Error('GPU query disjoint');}
   for(let i=run.pending.length-1;i>=0;i--){const q=run.pending[i];if(gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE)){const n=gl.getQueryParameter(q.query,gl.QUERY_RESULT);if(!Number.isFinite(n)||n<=0)throw Error('Invalid GPU query');run.gpu.push({mode:q.mode,at:q.at,ms:n/1e6});gl.deleteQuery(q.query);run.pending.splice(i,1);}}
   const age=now-run.start;if(orbit&&age>=4000&&age<20000)view.yaw=run.startYaw+(age-4000)/16000*Math.PI*2;const measure=age>=4000&&age<20000,mode=GPU_ABLATIONS[run.step++%GPU_ABLATIONS.length],query=measure&&run.frames.length%2===0?gl.createQuery():null;if(query)run.pending.push({query,mode,at:age});active=age<20000?{mode,query,measure}:null;
   const started=performance.now();let result;try{result=draw();if(measure)run.frames.push({mode,at:age,cpu:performance.now()-started,interval:run.last?now-run.last:0,calls:active.calls,triangles:active.triangles,camera:view.camera.position.toArray()});}finally{active=null;}run.last=now;
   if(age>=20000&&!run.pending.length)finish(s);else if(age>24000)throw Error('GPU query drain timeout');return result;
  }catch(error){active=null;finish(s,error.message);return draw();}
 }};
 window.addEventListener('pagehide',()=>{if(run)for(const q of run.pending)gl.deleteQuery(q.query);});
}
