// Diagnostic module only. Never imported by the delivered game.
export class TimerPool {
  constructor(gl, ext) { this.gl=gl;this.ext=ext;this.pending=null;this.active=null;this.issued=0;this.completed=0;this.deleted=0;this.disjoint=0;this.timeouts=0; }
  begin(frame,time,now) {
    if(!this.ext||this.pending||this.active||frame%8)return false;
    const query=this.gl.createQuery();if(!query)return false;
    this.active={query,frame,time,now};this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,query);this.issued++;return true;
  }
  end() {if(!this.active)return;this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending=this.active;this.active=null;}
  remove(){if(this.pending){this.gl.deleteQuery(this.pending.query);this.deleted++;this.pending=null;}}
  poll(now){
    if(!this.ext)return null;
    if(this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)){this.disjoint++;this.remove();return null;}
    const q=this.pending;if(!q)return null;
    if(this.gl.getQueryParameter(q.query,this.gl.QUERY_RESULT_AVAILABLE)){
      const ms=this.gl.getQueryParameter(q.query,this.gl.QUERY_RESULT)/1e6;
      if(!Number.isFinite(ms)||ms<=0)throw Error('Invalid native GPU duration');
      this.completed++;this.remove();return {frame:q.frame,time:q.time,ms,latencyMs:now-q.now};
    }
    if(now-q.now>10000){this.timeouts++;this.remove();}return null;
  }
  close(){this.end();this.remove();}
  stats(){return {supported:!!this.ext,issued:this.issued,completed:this.completed,deleted:this.deleted,disjointFrames:this.disjoint,timeouts:this.timeouts,pending:!!this.pending};}
}

export function installBudgetProbe(view,sink){
  const gl=view.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pool=new TimerPool(gl,ext),render=view.renderer.render;
  let frames=[],gpu=[],resources=[],inflight=0,peakInflight=0,dropped=0,active=false,frame=0,last=null,lastResource=-Infinity,renderCpu=0,hiddenFrames=0,contextLost=false,errors=[];
  function flush(){
    if(!frames.length&&!gpu.length&&!resources.length)return;
    if(inflight>=4){dropped+=frames.length;frames=[];gpu=[];resources=[];return;}
    const batch={frames,gpu,resources};frames=[];gpu=[];resources=[];inflight++;peakInflight=Math.max(peakInflight,inflight);
    Promise.resolve().then(()=>sink(batch)).catch(e=>errors.push(String(e))).finally(()=>inflight--);
  }
  view.canvas.addEventListener('webglcontextlost',()=>{contextLost=true;});
  view.renderer.render=function(...args){if(!active)return render.apply(this,args);const t=performance.now();pool.begin(frame,view.__budgetTime,t);try{return render.apply(this,args);}finally{pool.end();renderCpu+=performance.now()-t;}};
  const api={start(){active=true;last=null;},status(){return {active,frame,bufferedFrames:frames.length,inflight,peakInflight,dropped,hiddenFrames,contextLost,errors,...pool.stats()};},async stop(){active=false;pool.close();flush();while(inflight)await new Promise(r=>setTimeout(r,10));return api.status();}};
  window.runtimeBudget=api;
  return {draw(draw,state,moving){
    if(!active)return draw();
    const t=performance.now();view.__budgetTime=state.time;renderCpu=0;
    let result;try{result=draw();}finally{
      const end=performance.now(),sample=pool.poll(end);if(sample)gpu.push(sample);
      if(document.hidden)hiddenFrames++;
      frames.push([frame,t,state.time,state.player.x,state.player.z,state.player.hp,moving?1:0,last===null?null:t-last,end-t,renderCpu,view.renderer.info.render.calls,view.renderer.info.render.triangles]);last=t;
      if(t-lastResource>=1000){resources.push({frame,wall:t,time:state.time,geometries:view.renderer.info.memory.geometries,textures:view.renderer.info.memory.textures,programs:view.renderer.info.programs.length,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null,viewport:[innerWidth,innerHeight],buffer:[view.canvas.width,view.canvas.height],glError:gl.getError()});lastResource=t;}
      frame++;if(frames.length>=180)flush();
    }return result;
  }};
}
