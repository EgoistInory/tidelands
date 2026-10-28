// Observation-only fixture around the actual main draw; no production imports this.
export function installInlandRuntimeProbe(view,{candidate,lod,prepared,mirror}){
  const status=mirror.querySelector('#runtime-status'),out=mirror.querySelector('#runtime-result'),button=mirror.querySelector('#sample'),gl=view.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),nativeRender=view.renderer.render.bind(view.renderer),pending=[];
  let run=null,activeQuery=null,ready=false,lastStatus=0,lastGameTime=0;
  view.renderer.render=(...args)=>{if(activeQuery)gl.beginQuery(ext.TIME_ELAPSED_EXT,activeQuery);try{return nativeRender(...args);}finally{if(activeQuery)gl.endQuery(ext.TIME_ELAPSED_EXT);}};
  const summary=values=>{const s=[...values].sort((a,b)=>a-b);return {samples:s.length,min:s[0]??null,median:s[Math.floor(s.length*.5)]??null,p95:s[Math.floor(s.length*.95)]??null,max:s.at(-1)??null};};
  const snapshot=s=>({player:{...s.player},time:s.time,inventory:{...s.inventory},camera:view.camera.position.toArray(),requestedYaw:view.yaw,pitch:view.pitch,visible3D:view.inlandContacts?.trees.filter(t=>t.root.visible&&t.near.visible).length??0,worldUnchanged:JSON.stringify(view.world.objects)===view.inlandFrozen,viewport:[innerWidth,innerHeight],buffer:[view.canvas.width,view.canvas.height],render:{calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles},glError:gl.getError()});
  button.onclick=()=>{
    if(!ext)return;button.disabled=true;button.textContent='已准备，请继续旅程';run={start:null,initialGameTime:lastGameTime,first:null,last:null,frames:[],gpu:[],issued:0,stateBefore:null,startYaw:view.yaw,hidden:false,disjoint:0,error:null,finished:false};out.textContent=JSON.stringify({complete:false,candidate,lod});
  };
  function readQueries(){
    if(gl.getParameter(ext.GPU_DISJOINT_EXT)){run.disjoint++;throw Error('Native GPU query disjoint');}
    for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(!gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE))continue;const n=gl.getQueryParameter(q.query,gl.QUERY_RESULT);if(!Number.isFinite(n)||n<=0)throw Error('Invalid native GPU sample');run.gpu[q.index]=n/1e6;gl.deleteQuery(q.query);pending.splice(i,1);}
  }
  function finish(s){
    const after=snapshot(s),delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b)),jumps=run.frames.slice(1).map((f,i)=>Math.abs(delta(f.cameraYaw,run.frames[i].cameraYaw))),radii=run.frames.map(f=>f.cameraDistance);
    out.textContent=JSON.stringify({complete:!run.error,supported:!!ext,candidate,lod,hidden:run.hidden,disjointCount:run.disjoint,error:run.error,elapsedMs:performance.now()-run.start,stateBefore:run.stateBefore,stateAfter:after,frames:run.frames,gpuRawMs:run.gpu,gpuMs:summary(run.gpu),drawCpuMs:summary(run.frames.map(f=>f.drawCpuMs)),rafIntervalMs:summary(run.frames.slice(1).map(f=>f.intervalMs)),minCameraDistance:Math.min(...radii),maxCameraYawStep:Math.max(...jumps),worldUnchanged:after.worldUnchanged,shared3DGeometryBytes:candidate?(lod==='near'?97452456:76874756):0,resourceLODs:[...new Set(performance.getEntriesByType('resource').flatMap(e=>e.name.match(/inland-authored-component-candidate.*jacaranda_tree_(near|mid)\.(?:gltf|bin)$/)?.[1]??[]))],scope:'Actual current main rAF/tick/UI/save plus declared stationary q6/axe/zero-HP enemies and automated requested 360-degree orbit. GPU intervals wrap actual renderer.render; CPU draw and rAF intervals separated. No ordinary campaign/combat, input-driven continuous orbit, audio/VRAM/endurance/device or production integration proof.'});run.finished=true;button.textContent='采样完成';
  }
  view.inlandRuntimeProbe={draw(s,args,draw){
    const now=performance.now();lastGameTime=s.time;if(!ready){ready=true;button.disabled=!ext;status.textContent=ext?'先准备采样，再继续旅程。18秒环视；不读取普通档。':'当前无原生GPU计时扩展。';}
    if(!run||run.finished){const result=draw();if(now-lastStatus>1000){status.textContent=JSON.stringify(snapshot(s));lastStatus=now;}return result;}
    let measuring=false,query=null,cpu=0;
    try{
      if(run.start===null){if(Math.abs(s.time-run.initialGameTime)<.0001)return draw();run.start=now;}
      readQueries();run.hidden||=document.hidden;const age=now-run.start;
      // Two seconds of normal main-loop warmup precede a16-second requested orbit.
      if(age>=2000&&age<=18000){measuring=true;if(!run.first){run.first=now;run.stateBefore=snapshot(s);}view.yaw=run.startYaw+Math.min(1,(age-2000)/16000)*Math.PI*2;
        if(run.frames.length%8===0){query=gl.createQuery();activeQuery=query;pending.push({query,index:run.issued++});}
      }
      const start=performance.now();let result;try{result=draw();}finally{cpu=performance.now()-start;activeQuery=null;}
      if(measuring){const p=s.player,c=view.camera.position,dy=c.y-view.player.position.y-2.4;run.frames.push({atMs:now-run.start,intervalMs:run.last?now-run.last:0,drawCpuMs:cpu,camera:[c.x,c.y,c.z],cameraYaw:Math.atan2(c.x-p.x,c.z-p.z),requestedYaw:view.yaw,cameraDistance:Math.hypot(c.x-p.x,dy,c.z-p.z),visible3D:view.inlandContacts?.trees.filter(t=>t.root.visible&&t.near.visible).length??0});run.last=now;}
      if(age>18000&&pending.length===0)finish(s);else if(age>22000)throw Error('Native GPU drain exceeded4 seconds');
      return result;
    }catch(error){activeQuery=null;run.error=error.message;for(const q of pending)gl.deleteQuery(q.query);pending.length=0;finish(s);console.error(error);}
  }};
  window.addEventListener('pagehide',()=>{for(const q of pending)gl.deleteQuery(q.query);pending.length=0;});
}
