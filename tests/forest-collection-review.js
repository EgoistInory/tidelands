import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {WorldView} from '../src/scene.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {createWorld,terrain,LANDMARKS,SPAWN,randomGenerator} from '../src/world.js';
import {landscapeSample,landscapeMass} from '../src/landscape.js';
import {freshGame,movePlayer,tick,nearest,isDepleted} from '../src/game.js';
const revision=new URLSearchParams(location.search).get('revision')==='2'?2:1;
const world=createWorld(),view=new WorldView(document.querySelector('canvas'),world),out=document.querySelector('output'),group=new THREE.Group(),dummy=new THREE.Object3D();
view.scene.add(group);group.visible=false;
const original=view.batches.filter(b=>b.entries[0]?.type==='stone').map(b=>b.batch),positions=new Map(),meshes=[],models=[],rockBatches=[];
const places={coast:[-90,140],forest:[132,-26],highland:[-75,-175],shoal:[190,248],camp:[-80,98]};
const frozenWorld=JSON.stringify(world.objects);let state,frames=0,running=false,moving=false,last=null,hidden=false,intervals=[],distance=0,budget;
function matrix(x,z,sx,sy,sz,yaw){dummy.position.set(x,terrain(x,z),z);dummy.rotation.set(0,yaw,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();return dummy.matrix.clone();}
function add(key,matrix,node=null){if(!positions.has(key))positions.set(key,[]);positions.get(key).push({matrix,node});}
async function prepare(){
  const loader=new GLTFLoader();
  for(const name of ['fir_sapling','fern_02','rock_moss_set_01']){
    const gltf=await loader.loadAsync('../dist/'+(revision===2?'forest-collection-fulltree':'forest-collection-candidate')+'/'+name+'/'+name+'.gltf');models.push(gltf);
    for(const [i,model]of gltf.scene.children.entries()){
      model.position.set(0,0,0);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
      model.traverse(mesh=>{if(!mesh.isMesh)return;const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrixWorld);geometry.translate(-center.x,-box.min.y,-center.z);meshes.push({key:name+'-'+i,name,variant:i,geometry,material:mesh.material,size});});
    }
  }
  const rng=randomGenerator(20261026),rocks=world.objects.filter(o=>o.type==='stone');
  for(const [i,node]of rocks.entries()){
    const key='rock_moss_set_01-'+i%6,shape=meshes.find(m=>m.key===key),extent=Math.max(shape.size.x,shape.size.z),s=node.scale;
    add(key,matrix(node.x,node.z,4.6*s/extent,1.9*s/shape.size.y,4.6*s/extent,node.rotation),node);
  }
  const clear=(x,z,radius)=>terrain(x,z)>2.5&&!LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<13+radius)&&Math.hypot(x-SPAWN.x,z-SPAWN.z)>10+radius&&!world.objects.some(o=>Math.hypot(x-o.x,z-o.z)<2.3+radius);
  let patches=0;
  for(let x=-240;x<290;x+=22)for(let z=-330;z<290;z+=22){
    const px=x+rng()*14,pz=z+rng()*14,sample=landscapeSample(px,pz);
    if(terrain(px,pz)<3||terrain(px,pz)>33||landscapeMass(px,pz)<.38||sample.biome===3&&rng()<.65)continue;
    if(!clear(px,pz,1))continue;patches++;
    const sapling=sample.biome!==3&&rng()<.6;
    if(sapling){const key='fir_sapling-'+Math.floor(rng()*3),shape=meshes.find(m=>m.key===key),height=1.8+rng()*1.7,scale=height/shape.size.y;add(key,matrix(px,pz,scale,scale,scale,rng()*Math.PI*2));}
    for(let n=0;n<9;n++){
      const a=rng()*Math.PI*2,r=1+rng()*4,x=px+Math.cos(a)*r,z=pz+Math.sin(a)*r;
      if(!clear(x,z,.4))continue;const slope=Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5));if(slope>.6)continue;
      const key='fern_02-'+n%4,shape=meshes.find(m=>m.key===key),scale=(.45+rng()*.55)/shape.size.y;add(key,matrix(x,z,scale,scale,scale,rng()*Math.PI*2));
    }
  }
  for(const part of meshes){const all=positions.get(part.key);if(!all?.length)continue;const tiles=new Map();for(const v of all){const e=v.matrix.elements,key=revision===2?Math.floor(e[12]/32)+','+Math.floor(e[14]/32):'all';if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(v);}
    for(const entries of tiles.values()){const mesh=new THREE.InstancedMesh(part.geometry,part.material,entries.length);mesh.name=part.key;mesh.castShadow=mesh.receiveShadow=true;entries.forEach((v,i)=>mesh.setMatrixAt(i,v.matrix));mesh.computeBoundingSphere();mesh.userData.center=entries.reduce((a,v)=>[a[0]+v.matrix.elements[12]/entries.length,a[1]+v.matrix.elements[14]/entries.length],[0,0]);mesh.userData.isRock=part.name==='rock_moss_set_01';group.add(mesh);if(part.name==='rock_moss_set_01')rockBatches.push({mesh,entries});}}
  budget={patches,instances:[...positions.values()].reduce((s,e)=>s+e.length,0),saplings:[...positions].filter(([k])=>k.startsWith('fir')).reduce((s,[,e])=>s+e.length,0),ferns:[...positions].filter(([k])=>k.startsWith('fern')).reduce((s,[,e])=>s+e.length,0),rocks:rocks.length,batches:group.children.length,triangles:group.children.reduce((s,b)=>s+(b.geometry.index?.count??b.geometry.attributes.position.count)/3*b.count,0)};
}
function draw(){if(revision===2)for(const mesh of group.children){const [x,z]=mesh.userData.center;mesh.visible=mesh.userData.isRock||Math.hypot(x-state.player.x,z-state.player.z)<55;}view.draw(state,nearest(state,world.objects),null,moving,1/60);const sorted=[...intervals].sort((a,b)=>a-b),info=view.renderer.info;
out.textContent=JSON.stringify({ready:true,revision,art:document.querySelector('#art').value,scene:document.querySelector('#scene').value,position:[state.player.x,state.player.z],time:state.time,hp:state.player.hp,camera:view.camera.position.toArray(),worldUnchanged:JSON.stringify(world.objects)===frozenWorld,frames,running,hidden,distance,budget,render:{calls:info.render.calls,triangles:info.render.triangles,textures:info.memory.textures,geometries:info.memory.geometries},raf:sorted.length?{samples:sorted.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)}:null,viewport:[innerWidth,innerHeight],buffer:[view.canvas.width,view.canvas.height],glError:view.renderer.getContext().getError(),scope:'Declared place/q6/time/buildings fixture, current production cast/terrain/camera and movement. New decoration has no body/camera/wind integration; original stone bounds retained. Both groups resident. Not ordinary journey, GPU, memory, listening or final quality acceptance.'});}
function reset(){const name=document.querySelector('#scene').value,[x,z]=places[name];state=freshGame();state.quest=6;Object.assign(state.player,{x,z});state.time=name==='camp'?0:240;
if(name==='camp')state.buildings=[{id:'forest-qa-fire',type:'campfire',x:-80,z:104},{id:'forest-qa-tent',type:'tent',x:-91,z:110}];view.yaw=.15;view.pitch=.29;view.camera.position.set(x+5,Math.max(terrain(x,z),0)+12,z+20);view.player.userData.lastPosition=null;view.player.userData.worldFeet=null;view.sync(state);
for(const {mesh,entries}of rockBatches){entries.forEach((v,i)=>mesh.setMatrixAt(i,isDepleted(state,v.node)?new THREE.Matrix4().makeScale(0,0,0):v.matrix));mesh.instanceMatrix.needsUpdate=true;}
const candidate=document.querySelector('#art').value==='candidate';group.visible=candidate;for(const mesh of original)mesh.visible=!candidate;frames=0;distance=0;hidden=false;intervals=[];moving=false;last=null;for(let i=0;i<60;i++)draw();}
document.querySelectorAll('button,select').forEach(e=>e.disabled=true);
Promise.all([prepare(),loadAuthoredCast().then(c=>view.installAuthoredCast(c)),view.groundSurface.userData.ground.loaded,view.groundSurface.userData.ground.sand.loaded,view.rockSurface.userData.rock.loaded]).then(()=>{reset();document.querySelectorAll('button,select').forEach(e=>e.disabled=false);}).catch(e=>{console.error(e);out.textContent='失败：'+e.message;});
document.querySelectorAll('select').forEach(e=>e.onchange=reset);
document.querySelector('#run').onclick=()=>{running=true;document.querySelectorAll('select,button').forEach(e=>e.disabled=true);const frame=now=>{if(last!==null)intervals.push(now-last);last=now;hidden||=document.hidden;const p=state.player,before=[p.x,p.z];movePlayer(state,world.objects,frames<90?0:1,frames<90?1:0,1/60,false);const moved=Math.hypot(p.x-before[0],p.z-before[1]);distance+=moved;moving=moved>.001;tick(state,1/60,false,null,world.objects);view.sync(state);frames++;draw();if(frames<180)requestAnimationFrame(frame);else{running=false;moving=false;draw();document.querySelectorAll('select,button').forEach(e=>e.disabled=false);}};requestAnimationFrame(frame);};
window.addEventListener('resize',()=>{view.resize();if(state&&!running)draw();});
window.addEventListener('pagehide',()=>{view.authoredCast?.release();const g=new Set(),m=new Set(),t=new Set();for(const o of meshes){g.add(o.geometry);m.add(o.material);}for(const model of models)model.scene.traverse(o=>{if(o.isMesh){g.add(o.geometry);m.add(o.material);}});for(const material of m){for(const v of Object.values(material))if(v?.isTexture)t.add(v);material.dispose();}for(const geometry of g)geometry.dispose();for(const texture of t)texture.dispose();view.contactShade.dispose();view.renderer.dispose();});
