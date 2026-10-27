import * as THREE from '../dist/coastal-contact-r2/tidelands-local/vendor/three.module.min.js';
import {WorldView} from '../dist/coastal-contact-r2/tidelands-local/src/scene.js';
import {createWorld,terrain} from '../dist/coastal-contact-r2/tidelands-local/src/world.js';
import {freshGame,nearest,movePlayer,isDepleted} from '../dist/coastal-contact-r2/tidelands-local/src/game.js';
import {loadAuthoredCast} from '../dist/coastal-contact-r2/tidelands-local/src/authored-assets.js';
import {loadWoodlandDressing} from '../dist/coastal-contact-r2/tidelands-local/src/woodland.js';
import {prepareCoastalVisual,bindCoastalVisual} from './coastal-contact-visual.js';
import {createCoastalFarBatches} from './coastal-far-batches.js';
import {coastalBudgetLevels} from './coastal-level-budget.js';
const world=createWorld(),worldJson=JSON.stringify(world),view=new WorldView(document.querySelector('canvas'),world),output=document.querySelector('output'),mode=document.querySelector('#mode'),place=document.querySelector('#place');
let state,visual,far,pose=null,motion=null,narrow=false;
// Lock the render camera for card/batch comparisons, after normal camera settling.
const render=view.renderer.render.bind(view.renderer);
view.renderer.render=(scene,camera)=>{if(pose){camera.position.copy(pose.position);camera.quaternion.copy(pose.quaternion);camera.updateMatrixWorld(true);}return render(scene,camera);};
function draw(dt=0){
  visual.update(state);
  if(mode.value==='budget'){
    const levels=new Map(coastalBudgetLevels(visual.trees.map(t=>t.node),state.player,new Set(visual.trees.filter(t=>isDepleted(state,t.node)).map(t=>t.node.id))).map(r=>[r.id,r.level]));
    for(const tree of visual.trees){tree.level=levels.get(tree.node.id);tree.root.visible=tree.level!=='hidden';for(const k of ['near','mid','far'])tree[k].visible=k===tree.level;}
  }
  if(mode.value!=='cards'){far.update();visual.trees.forEach(t=>t.far.visible=false);}else far.batches.forEach(b=>b.visible=false);
  view.draw(state,nearest(state,world.objects),null,false,dt);
  output.textContent=JSON.stringify({ready:true,mode:mode.value,place:place.value,player:state.player,time:state.time,camera:view.camera.position.toArray(),quaternion:view.camera.quaternion.toArray(),levels:Object.fromEntries(['near','mid','far','hidden'].map(l=>[l,visual.trees.filter(t=>t.level===l).length])),batchCounts:far.batches.map(b=>b.visible?b.count:0),render:{...view.renderer.info.render},memory:{...view.renderer.info.memory},viewport:[view.camera.aspect,view.canvas.clientWidth,view.canvas.clientHeight],buffer:[view.canvas.width,view.canvas.height],glError:view.renderer.getContext().getError(),worldUnchanged:JSON.stringify(world)===worldJson,motion,scope:'Isolated deterministic camera/render comparison and real movePlayer QA path; no ordinary save or full-main journey/GPU/endurance acceptance.'});
}
function reset(){
  const dense=world.objects.find(o=>o.id==='resource-524'),points={coast:[-123,128],shoal:[190,248],dense:[dense.x,dense.z],camp:[-80,98]},[x,z]=points[place.value];
  state=freshGame();state.quest=6;state.enemies.forEach(e=>e.hp=0);Object.assign(state.player,{x,z});state.time=place.value==='camp'?0:240;
  if(place.value==='camp')state.buildings=[{id:'batch-qa-camp',type:'campfire',x:-80,z:104}];
  view.sync(state);view.yaw=.15;view.pitch=.29;view.camera.position.set(x+5,Math.max(terrain(x,z),0)+12,z+20);view.player.userData.lastPosition=null;view.player.userData.worldFeet=null;pose=null;motion=null;
  for(let i=0;i<60;i++)draw(1/60);
  pose={position:view.camera.position.clone(),quaternion:view.camera.quaternion.clone()};draw();
}
document.querySelector('#motion').onclick=()=>{
  document.querySelectorAll('select,button').forEach(e=>e.disabled=true);pose=null;let frames=0,last=null,first=null;const intervals=[],positions=[],levels=new Set();
  const initial={x:state.player.x,z:state.player.z};
  function frame(now){
    if(first===null)first=now;if(last!==null)intervals.push(now-last);last=now;
    const angle=frames*Math.PI*2/240;movePlayer(state,world.objects,Math.sin(angle),Math.cos(angle),1/60);state.time+=1/60;view.yaw+=Math.PI*2/240;
    motion={frames:++frames,elapsedMs:now-first,initial};draw(1/60);
    positions.push([state.player.x,state.player.z]);for(const tree of visual.trees)levels.add(tree.node.id+'/'+tree.level);
    if(frames<240)requestAnimationFrame(frame);else{
      intervals.sort((a,b)=>a-b);motion={...motion,p95RafMs:intervals[Math.floor(intervals.length*.95)],maxRafMs:intervals.at(-1),positionSamples:positions.length,maxDisplacement:Math.max(...positions.map(([x,z])=>Math.hypot(x-initial.x,z-initial.z))),distinctNodeLevels:levels.size};
      pose={position:view.camera.position.clone(),quaternion:view.camera.quaternion.clone()};draw();document.querySelectorAll('select,button').forEach(e=>e.disabled=false);
    }
  }requestAnimationFrame(frame);
};
document.querySelector('#size').onclick=()=>{narrow=!narrow;document.body.classList.toggle('narrow',narrow);const canvas=view.canvas,w=narrow?390:innerWidth,h=narrow?844:innerHeight;view.renderer.setSize(w,h,false);view.camera.aspect=w/h;view.camera.updateProjectionMatrix();draw();};
mode.onchange=()=>draw();place.onchange=reset;
window.addEventListener('resize',()=>{view.resize();if(state)draw();});
try{
  const prepared=await prepareCoastalVisual();visual=bindCoastalVisual(view,prepared);far=createCoastalFarBatches(THREE,view.scene,visual.trees);
  await Promise.all([loadAuthoredCast().then(c=>view.installAuthoredCast(c)),loadWoodlandDressing(world.objects).then(d=>view.installWoodlandDressing(d)),view.groundSurface.userData.ground.loaded,view.groundSurface.userData.ground.sand.loaded,view.rockSurface.userData.rock.loaded]);
  reset();document.querySelectorAll('select,button').forEach(e=>e.disabled=false);
}catch(error){console.error(error);output.textContent='失败：'+error.message;}
window.addEventListener('pagehide',()=>{far?.release();visual?.release();view.woodlandDressing?.release();view.authoredCast?.release();view.contactShade.dispose();view.renderer.dispose();});
