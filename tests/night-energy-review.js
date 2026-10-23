import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {createWorld,terrain,dayCycle,weatherAt} from '../src/world.js';
import {freshGame,movePlayer,tick,nearest} from '../src/game.js';

const world=createWorld(),canvas=document.querySelector('canvas'),out=document.querySelector('output'),view=new WorldView(canvas,world);
const originalAtmosphere=view.updateAtmosphere.bind(view);
// Reconstruct only the frozen baseline energy; the fill branch uses production unchanged.
view.updateAtmosphere=(time,weather)=>{originalAtmosphere(time,weather);if(document.querySelector('#lighting').value==='baseline')view.ambient.intensity=(.6+Math.sqrt((dayCycle(time).daylight-.04)/.96)*1.5)*weather.skylight;};
const places={camp:[-56,49],forest:[132,-26],shore:[-90,140]};
let state,frames=0,running=false,moving=false,last=null,intervals=[],distance=0,hidden=false;
function draw(){
  view.draw(state,nearest(state,world.objects),null,moving,1/60);const sorted=[...intervals].sort((a,b)=>a-b),info=view.renderer.info;
  out.textContent=JSON.stringify({ready:true,lighting:document.querySelector('#lighting').value,scene:document.querySelector('#scene').value,orbit:view.yaw,time:state.time,weather:weatherAt(state.time),position:[state.player.x,state.player.z],hp:state.player.hp,camera:view.camera.position.toArray(),energy:{ambient:view.ambient.intensity,sun:view.sun.intensity,moon:view.nightLight.intensity,fire:view.fireLight.intensity},colors:{sky:view.ambient.color.toArray(),ground:view.ambient.groundColor.toArray()},frames,running,hidden,distance,raf:sorted.length?{samples:sorted.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)}:null,render:{calls:info.render.calls,triangles:info.render.triangles,textures:info.memory.textures},viewport:[innerWidth,innerHeight],buffer:[canvas.width,canvas.height],glError:view.renderer.getContext().getError(),scope:'Isolated ambient energy comparison. Current production world/cast/move/tick/camera; declared locations/q6/camp, no persistence/audio. No GPU/endurance/device/final quality acceptance.'});
}
function reset(){
  const [x,z]=places[document.querySelector('#scene').value];state=freshGame();Object.assign(state.player,{x,z});state.time=Number(document.querySelector('#time').value);state.quest=6;
  if(document.querySelector('#scene').value==='camp')state.buildings=[{id:'energy-fire',type:'campfire',x:-56,z:56},{id:'energy-tent',type:'tent',x:-65,z:49},{id:'energy-bench',type:'workbench',x:-47,z:49}];
  frames=0;running=moving=hidden=false;last=null;intervals=[];distance=0;view.yaw=Number(document.querySelector('#orbit').value);view.pitch=.29;view.player.userData.lastPosition=null;view.player.userData.worldFeet=null;view.camera.position.set(x+Math.sin(view.yaw)*20,Math.max(terrain(x,z),0)+12,z+Math.cos(view.yaw)*20);view.sync(state);view.resize();for(let i=0;i<60;i++)draw();
}
for(const s of document.querySelectorAll('select'))s.onchange=reset;
document.querySelector('#run').onclick=()=>{
  view.resize();running=true;document.querySelectorAll('button,select').forEach(e=>e.disabled=true);
  function frame(now){if(last!==null)intervals.push(now-last);last=now;hidden||=document.hidden;const p=state.player,before=[p.x,p.z],a=frames<90?0:Math.PI/2;movePlayer(state,world.objects,Math.sin(a),Math.cos(a),1/60,false);const d=Math.hypot(p.x-before[0],p.z-before[1]);distance+=d;moving=d>.001;tick(state,1/60,false,null,world.objects);view.sync(state);frames++;draw();if(frames<180)requestAnimationFrame(frame);else{running=false;moving=false;draw();document.querySelectorAll('button,select').forEach(e=>e.disabled=false);}}requestAnimationFrame(frame);
};
document.querySelectorAll('button,select').forEach(e=>e.disabled=true);
Promise.all([loadAuthoredCast().then(cast=>view.installAuthoredCast(cast)),view.groundSurface.userData.ground.loaded,view.groundSurface.userData.ground.sand.loaded,view.rockSurface.userData.rock.loaded]).then(()=>{reset();document.querySelectorAll('button,select').forEach(e=>e.disabled=false);}).catch(error=>{out.textContent='加载失败：'+error.message;console.error(error);});
window.addEventListener('resize',()=>{view.resize();if(state&&!running)draw();});window.addEventListener('pagehide',()=>{view.authoredCast?.release();view.impacts.dispose();view.contactShade.dispose();view.renderer.dispose();});
