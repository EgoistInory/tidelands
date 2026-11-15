// Read-only diagnostic: one query surrounds the complete WorldView.draw, including HDR passes.
import {TimerPool} from './runtime_budget_probe.js';
export function installJourneyProbe(view,sink){
 const gl=view.renderer.getContext(),pool=new TimerPool(gl,gl.getExtension('EXT_disjoint_timer_query_webgl2')),render=view.renderer.render;
 let active=false,closed=false,capturing=false,frame=0,last=null,lastResource=-Infinity,renderCpu=0,calls=0,triangles=0,passes=0,inflight=0,peakInflight=0,dropped=0,hiddenFrames=0,contextLost=false;
 let frames=[],gpu=[],resources=[];const errors=[];
 const wrapped=function(...args){const t=performance.now();try{return render.apply(this,args);}finally{if(capturing){renderCpu+=performance.now()-t;calls+=this.info.render.calls;triangles+=this.info.render.triangles;passes++;}}};view.renderer.render=wrapped;
 view.canvas.addEventListener('webglcontextlost',()=>{contextLost=true;});
 function flush(){
  if(!frames.length&&!gpu.length&&!resources.length)return;
  if(inflight>=4){dropped+=frames.length;frames=[];gpu=[];resources=[];return;}
  const batch={frames,gpu,resources};frames=[];gpu=[];resources=[];inflight++;peakInflight=Math.max(peakInflight,inflight);
  Promise.resolve().then(()=>sink(batch)).catch(e=>errors.push(String(e))).finally(()=>inflight--);
 }
 const status=()=>({active,closed,frames:frame,bufferedFrames:frames.length,inflight,peakInflight,dropped,hiddenFrames,contextLost,errors,...pool.stats()});
 window.journeyProbe={start(){if(closed)throw Error('Journey probe already closed');active=true;last=null;},status,async stop(){active=false;closed=true;pool.close();if(view.renderer.render===wrapped)view.renderer.render=render;flush();while(inflight)await new Promise(r=>setTimeout(r,10));return status();}};
 return {draw(draw,state,moving){
  if(!active)return draw();const t=performance.now();renderCpu=calls=triangles=passes=0;capturing=true;pool.begin(frame,state.time,t);
  try{return draw();}finally{
   pool.end();capturing=false;const end=performance.now(),sample=pool.poll(end);if(sample)gpu.push(sample);
   if(document.hidden)hiddenFrames++;
   const camera=view.camera.position.toArray();frames.push([frame,t,state.time,state.player.x,state.player.z,state.player.hp,moving?1:0,last===null?null:t-last,end-t,renderCpu,calls,triangles,passes,...camera]);last=t;
   if(t-lastResource>=1000){resources.push({frame,wall:t,time:state.time,geometries:view.renderer.info.memory.geometries,textures:view.renderer.info.memory.textures,programs:view.renderer.info.programs.length,viewport:[innerWidth,innerHeight],buffer:[view.canvas.width,view.canvas.height],glError:gl.getError()});lastResource=t;}
   frame++;if(frames.length>=180)flush();
  }
 }};
}
