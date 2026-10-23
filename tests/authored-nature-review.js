import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {WorldView} from '../src/scene.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {createWorld,terrain,LANDMARKS,randomGenerator} from '../src/world.js';
import {islandTreeAppearance,landscapeMass} from '../src/landscape.js';
import {freshGame,movePlayer,tick,nearest} from '../src/game.js';

const names=['CommonTree_1','CommonTree_2','CommonTree_3','Pine_1','Pine_2','Pine_3','Bush_Common','Fern_1','Plant_1','Flower_3_Group','Grass_Wispy_Short'];
const canvas=document.querySelector('canvas'),out=document.querySelector('output'),world=createWorld(),view=new WorldView(canvas,world);
const places={coast:[-90,140],forest:[132,-26],highland:[-75,-175],shoal:[190,248],camp:[-56,49]};
const candidate=new THREE.Group(),dummy=new THREE.Object3D(),placements=new Map(names.map(n=>[n,[]]));
view.scene.add(candidate);candidate.visible=false;
const originals=view.batches.filter(b=>b.entries[0]?.type==='tree').map(b=>b.batch);
let state,running=false,moving=false,frames=0,hidden=false,intervals=[],distance=0,last=null,models=[],budget=null;
const frozenWorld=JSON.stringify(world.objects);
function draw(){
  view.draw(state,nearest(state,world.objects),null,moving,1/60);
  const sorted=[...intervals].sort((a,b)=>a-b),info=view.renderer.info;
  out.textContent=JSON.stringify({ready:true,art:document.querySelector('#art').value,scene:document.querySelector('#scene').value,time:state.time,position:[state.player.x,state.player.z],hp:state.player.hp,camera:view.camera.position.toArray(),frames,running,hidden,distance,worldUnchanged:JSON.stringify(world.objects)===frozenWorld,budget,render:{calls:info.render.calls,triangles:info.render.triangles,textures:info.memory.textures,geometries:info.memory.geometries},raf:sorted.length?{samples:sorted.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)}:null,viewport:[innerWidth,innerHeight],buffer:[canvas.width,canvas.height],glError:view.renderer.getContext().getError(),scope:'Isolated authored tree+understory candidate. Production terrain, rules, camera obstacles and cast; declared q6/location/camp fixtures, no persistence/audio. Old camera bounds deliberately unchanged: candidate silhouette/clearance not accepted. No GPU, real device or final quality acceptance.'});
}
function reset(){
  const [x,z]=places[document.querySelector('#scene').value];state=freshGame();Object.assign(state.player,{x,z});state.time=Number(document.querySelector('#light').value);state.quest=6;
  if(document.querySelector('#scene').value==='camp')state.buildings=[{id:'nature-fire',type:'campfire',x:-56,z:56},{id:'nature-tent',type:'tent',x:-65,z:49},{id:'nature-bench',type:'workbench',x:-47,z:49}];
  frames=0;moving=false;hidden=false;intervals=[];distance=0;last=null;view.yaw=.15;view.pitch=.29;view.player.userData.lastPosition=null;view.player.userData.worldFeet=null;view.camera.position.set(x+5,Math.max(terrain(x,z),0)+12,z+20);view.sync(state);
  const useCandidate=document.querySelector('#art').value==='candidate';candidate.visible=useCandidate;for(const b of originals)b.visible=!useCandidate;
  for(let i=0;i<60;i++)draw();
}
function place(name,x,z,scale,yaw,stretch=1){dummy.position.set(x,terrain(x,z),z);dummy.rotation.set(0,yaw,0);dummy.scale.set(scale,scale*stretch,scale);dummy.updateMatrix();placements.get(name).push(dummy.matrix.clone());}
async function prepare(){
  const loader=new GLTFLoader(),materialCache=new Map();
  models=await Promise.all(names.map(name=>loader.loadAsync('../dist/nature-candidate/'+name+'.gltf')));
  const heights=new Map();
  for(let i=0;i<models.length;i++){
    const model=models[i].scene;model.updateMatrixWorld(true);heights.set(names[i],new THREE.Box3().setFromObject(model).max.y);
    model.traverse(o=>{if(!o.isMesh)return;const key=o.material.name;if(materialCache.has(key)){const old=o.material;o.material=materialCache.get(key);old.dispose();}else materialCache.set(key,o.material);});
  }
  const random=randomGenerator(20361023),trees=world.objects.filter(o=>o.type==='tree');
  for(const [i,o]of trees.entries()){
    const appearance=islandTreeAppearance(o),name=(appearance.form==='highland'?'Pine_':'CommonTree_')+(i%3+1);
    place(name,o.x,o.z,o.scale*8/heights.get(name),o.rotation,appearance.height);
    const mass=landscapeMass(o.x,o.z);
    if(mass<.3||appearance.form==='highland')continue;
    for(let p=0;p<4;p++){
      const a=random()*Math.PI*2,r=3+random()*6,x=o.x+Math.sin(a)*r,z=o.z+Math.cos(a)*r,y=terrain(x,z);
      if(y<2||Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5))>.65)continue;
      if(LANDMARKS.some(l=>Math.hypot(x-l.x,z-l.z)<11)||world.objects.some(n=>Math.hypot(x-n.x,z-n.z)<2.5))continue;
      const name=p===0?'Bush_Common':p===1?'Fern_1':p===2?'Plant_1':appearance.form==='shoal'?'Flower_3_Group':'Grass_Wispy_Short';
      const height=(p===0?.9:p===1?.65:p===2?.7:.6)*(.75+random()*.5)*mass;
      place(name,x,z,height/heights.get(name),random()*Math.PI*2);
    }
  }
  for(let i=0;i<models.length;i++){
    const matrices=placements.get(names[i]);if(!matrices.length)continue;
    models[i].scene.traverse(o=>{
      if(!o.isMesh)return;
      const batch=new THREE.InstancedMesh(o.geometry,o.material,matrices.length);batch.name=names[i];batch.castShadow=batch.receiveShadow=true;
      matrices.forEach((m,j)=>batch.setMatrixAt(j,m.clone().multiply(o.matrixWorld)));batch.computeBoundingSphere();candidate.add(batch);
    });
  }
  budget={trees:trees.length,instances:Object.fromEntries([...placements].map(([n,a])=>[n,a.length])),batches:candidate.children.length,triangles:candidate.children.reduce((s,b)=>s+(b.geometry.index?.count??b.geometry.attributes.position.count)/3*b.count,0),materials:materialCache.size};
}
document.querySelectorAll('button,select').forEach(e=>e.disabled=true);
Promise.all([prepare(),loadAuthoredCast().then(cast=>view.installAuthoredCast(cast)),view.groundSurface.userData.ground.loaded,view.groundSurface.userData.ground.sand.loaded,view.rockSurface.userData.rock.loaded]).then(()=>{reset();document.querySelectorAll('button,select').forEach(e=>e.disabled=false);}).catch(error=>{out.textContent='加载失败：'+error.message;console.error(error);});
for(const select of document.querySelectorAll('select'))select.onchange=reset;
document.querySelector('#run').onclick=()=>{
  view.resize();running=true;document.querySelectorAll('button,select').forEach(e=>e.disabled=true);
  function frame(now){
    if(last!==null)intervals.push(now-last);last=now;hidden||=document.hidden;
    const p=state.player,before=[p.x,p.z],a=frames<90?0:Math.PI/2;movePlayer(state,world.objects,Math.sin(a),Math.cos(a),1/60,false);const d=Math.hypot(p.x-before[0],p.z-before[1]);distance+=d;moving=d>.001;tick(state,1/60,false,null,world.objects);view.sync(state);frames++;draw();
    if(frames<180)requestAnimationFrame(frame);else{running=false;moving=false;draw();document.querySelectorAll('button,select').forEach(e=>e.disabled=false);}
  }requestAnimationFrame(frame);
};
window.addEventListener('resize',()=>{view.resize();if(state&&!running)draw();});
window.addEventListener('pagehide',()=>{
  view.authoredCast?.release();const geometries=new Set(),materials=new Set(),textures=new Set();for(const m of models)m.scene.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);materials.add(o.material);});for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const g of geometries)g.dispose();for(const t of textures)t.dispose();view.contactShade.dispose();view.renderer.dispose();
});
