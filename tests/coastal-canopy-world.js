import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {WorldView} from '../src/scene.js';
import {createWorld,terrain,LANDMARKS,SPAWN} from '../src/world.js';
import {islandTreeAppearance} from '../src/landscape.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {loadWoodlandDressing} from '../src/woodland.js';
import {freshGame,nearest,isDepleted} from '../src/game.js';

// Isolated integration probe. Static resource identities and the production body rules stay intact.
// The actual authored low-branch body envelope has NOT been accepted against those old rules.
const UNIT=2.95/1.8195863831788301,world=createWorld(),frozen=JSON.stringify(world),view=new WorldView(document.querySelector('canvas'),world),output=document.querySelector('output');
const originalTrees=view.batches.filter(r=>r.entries[0]?.type==='tree'),originalObstacles=view.cameraObstacles,models=[],trees=[],keptBatches=[],clock={value:240};
const chosen=world.objects.filter(o=>o.type==='tree'&&['coast','shoal'].includes(islandTreeAppearance(o).form)&&!o.id.startsWith('starter')&&Math.hypot(o.x-SPAWN.x,o.z-SPAWN.z)>18&&!LANDMARKS.some(l=>Math.hypot(o.x-l.x,o.z-l.z)<12)),ids=new Set(chosen.map(o=>o.id));
const parts=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
function wind(material,minY,height){material.onBeforeCompile=shader=>{shader.uniforms.coastalTime=clock;shader.vertexShader='uniform float coastalTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  vec3 coastalWorld=(modelMatrix*vec4(position,1.0)).xyz;
  float bend=smoothstep(${(minY+.6).toFixed(8)},${(minY+height).toFixed(8)},position.y);bend*=bend;
  transformed.x+=sin(coastalTime*1.1+coastalWorld.x*.13+coastalWorld.z*.17)*bend*.04;
  transformed.z+=cos(coastalTime*.9+coastalWorld.z*.15)*bend*.025;
`);};material.customProgramCacheKey=()=>`coastal-probe-${minY}-${height}`;}
async function loadModels(){
  const loader=new GLTFLoader(),textureLoader=new THREE.TextureLoader();
  for(const name of ['island_tree_01','island_tree_02','island_tree_03']){
    const [near,mid]=await Promise.all(['near','mid'].map(level=>loader.loadAsync(`../dist/canopy-authored-candidate/${name}/${name}_${level}.gltf`)));
    const box=new THREE.Box3().setFromObject(near.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),materials=parts(near.scene).map(p=>p.material);
    parts(mid.scene).forEach((p,i)=>{const old=p.material;for(const value of Object.values(old))if(value?.isTexture)value.dispose();old.dispose();p.material=materials[i];});
    for(const root of [near.scene,mid.scene])parts(root).forEach(mesh=>{
      const m=mesh.material;if(m.name.endsWith('_leaves')){m.alphaTest=0;m.alphaToCoverage=true;}
      mesh.castShadow=mesh.receiveShadow=true;wind(m,box.min.y,size.y);
      mesh.customDepthMaterial=new THREE.MeshDepthMaterial({map:m.map,alphaTest:m.name.endsWith('_leaves')?.45:0,side:m.side,depthPacking:THREE.RGBADepthPacking});wind(mesh.customDepthMaterial,box.min.y,size.y);
    });
    const width=Math.max(size.x,size.z)*1.05,height=size.y*1.05,farGeometry=new THREE.PlaneGeometry(width,height);farGeometry.translate(0,center.y,0);
    const farMaterials=[];for(let frame=0;frame<4;frame++){
      const [map,normalMap]=await Promise.all(['color','normal'].map(kind=>textureLoader.loadAsync(`../dist/canopy-authored-candidate/impostors-r3/${name}-${frame}-${kind}.png`)));map.colorSpace=THREE.SRGBColorSpace;
      const m=new THREE.MeshStandardMaterial({map,normalMap,roughness:1,alphaTest:0,alphaToCoverage:true,side:THREE.DoubleSide});wind(m,box.min.y,size.y);farMaterials.push(m);
    }
    models.push({name,near:near.scene,mid:mid.scene,box,size,center,farGeometry,farMaterials});
  }
  for(const record of originalTrees){
    const rows=record.entries.map((o,i)=>({o,i})).filter(({o})=>!ids.has(o.id));if(!rows.length)continue;
    const batch=new THREE.InstancedMesh(record.batch.geometry,record.batch.material,rows.length);batch.customDepthMaterial=record.batch.customDepthMaterial;batch.castShadow=batch.receiveShadow=true;
    rows.forEach(({i},j)=>{const matrix=new THREE.Matrix4();record.batch.getMatrixAt(i,matrix);batch.setMatrixAt(j,matrix);if(record.batch.instanceColor){const color=new THREE.Color();record.batch.getColorAt(i,color);batch.setColorAt(j,color);}});batch.computeBoundingSphere();batch.visible=false;view.scene.add(batch);keptBatches.push(batch);
  }
  for(const [index,node] of chosen.entries()){
    const model=models[index%3],root=new THREE.Group(),scale=node.scale*UNIT;root.position.set(node.x,node.y-model.box.min.y*scale,node.z);root.rotation.y=node.rotation;root.scale.setScalar(scale);
    const near=model.near.clone(true),mid=model.mid.clone(true),far=new THREE.Mesh(model.farGeometry,model.farMaterials[0]);for(const key of ['near','mid'])parts(key==='near'?near:mid).forEach((p,i)=>p.customDepthMaterial=parts(model[key])[i].customDepthMaterial);far.position.set(model.center.x,0,model.center.z);near.visible=mid.visible=far.visible=false;root.add(near,mid,far);root.visible=false;root.updateMatrixWorld(true);view.scene.add(root);
    const boxes=parts(near).map(p=>new THREE.Box3().setFromObject(p).expandByScalar(scale*.05));
    trees.push({node,model,root,near,mid,far,boxes,level:'hidden'});
  }
}
let state,motion=null;
const places={coast:[-123,128],shoal:[190,248],grove:[202,-39],highland:[-75,-175],camp:[-80,98]};
function chooseLevels(){
  const active=document.querySelector('#art').value==='candidate',sorted=trees.map(t=>({t,d:Math.hypot(t.node.x-state.player.x,t.node.z-state.player.z)})).sort((a,b)=>a.d-b.d);let nearCount=0,midCount=0;
  for(const {t,d}of sorted){let level='far';if(d<18&&nearCount<2){level='near';nearCount++;}else if(d<40&&midCount<6){level='mid';midCount++;}if(d>260||isDepleted(state,t.node))level='hidden';
    t.level=level;t.root.visible=active&&level!=='hidden';for(const key of ['near','mid','far'])t[key].visible=key===level;
    const angle=Math.atan2(view.camera.position.x-t.node.x,view.camera.position.z-t.node.z)-t.node.rotation,frame=((Math.round(angle/(Math.PI/2))%4)+4)%4;
    t.far.rotation.y=frame*Math.PI/2;t.far.material=t.model.farMaterials[frame];
  }
  originalTrees.forEach(r=>r.batch.visible=!active);keptBatches.forEach(b=>b.visible=active);
  view.cameraObstacles=active?[...originalObstacles.filter(o=>!ids.has(o.object.id)),...trees.map(t=>({object:t.node,boxes:t.boxes}))]:originalObstacles;
}
function draw(){
  clock.value=state.time;chooseLevels();view.draw(state,nearest(state,world.objects),null,false,1/60);
  output.textContent=JSON.stringify({ready:true,art:document.querySelector('#art').value,scene:document.querySelector('#scene').value,worldUnchanged:JSON.stringify(world)===frozen,unitFactor:UNIT,selectedNodes:chosen.length,selectedIds:chosen.map(o=>o.id),levels:Object.fromEntries(['near','mid','far','hidden'].map(k=>[k,trees.filter(t=>t.level===k).length])),camera:view.camera.position.toArray(),position:[state.player.x,state.player.z],time:state.time,motion,render:{calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles,textures:view.renderer.info.memory.textures,geometries:view.renderer.info.memory.geometries},viewport:[innerWidth,innerHeight],buffer:[view.canvas.width,view.canvas.height],glError:view.renderer.getContext().getError(),productionIntegrated:false,bodyOrBuildCollisionAccepted:false,farLightingAndTransitionAccepted:false,scope:'Isolated fixed-position world fixtures. Existing actor-to-world unit factor,133 coast/shoal resource IDs retained; starter/landmark surroundings and inland forms kept. Authored part AABB camera probe, unaccepted old1.15 body rules, near2/mid6 count caps, far4 discrete views without transition. Both alternatives resident; not net memory, GPU, ordinary gameplay, true device or M5 acceptance.'});
}
function reset(){const name=document.querySelector('#scene').value,[x,z]=places[name];state=freshGame();Object.assign(state.player,{x,z});state.quest=6;state.time=name==='camp'?0:240;if(name==='camp')state.buildings=[{id:'coastal-qa-fire',type:'campfire',x:-80,z:104}];motion=null;
  view.yaw=.15;view.pitch=.29;view.camera.position.set(x+5,Math.max(terrain(x,z),0)+12,z+20);view.player.userData.lastPosition=null;view.player.userData.worldFeet=null;view.sync(state);for(let i=0;i<60;i++)draw();
}
document.querySelector('#motion').onclick=()=>{document.querySelectorAll('select,button').forEach(e=>e.disabled=true);let frames=0,first=null,last=null;const times=[];function frame(now){if(first===null)first=now;if(last!==null)times.push(now-last);last=now;state.time+=1/60;motion={frames:++frames,elapsedMs:now-first};draw();if(frames<180)requestAnimationFrame(frame);else{times.sort((a,b)=>a-b);motion={...motion,p95RafMs:times[Math.floor(times.length*.95)],maxRafMs:times.at(-1),scope:'180 fixed tick wind/render frames, fixed actor and camera; not GPU timing, traversal or long-run proof'};draw();document.querySelectorAll('select,button').forEach(e=>e.disabled=false);}}requestAnimationFrame(frame);};
Promise.all([loadModels(),loadAuthoredCast().then(c=>view.installAuthoredCast(c)),loadWoodlandDressing(world.objects).then(d=>view.installWoodlandDressing(d)),view.groundSurface.userData.ground.loaded,view.groundSurface.userData.ground.sand.loaded,view.rockSurface.userData.rock.loaded]).then(()=>{reset();document.querySelectorAll('select,button').forEach(e=>e.disabled=false);}).catch(e=>{console.error(e);output.textContent='失败：'+e.message;});
document.querySelectorAll('select').forEach(e=>e.onchange=reset);window.addEventListener('resize',()=>{view.resize();if(state)draw();});
window.addEventListener('pagehide',()=>{view.woodlandDressing?.release();view.authoredCast?.release();const geometries=new Set(),materials=new Set(),textures=new Set();for(const model of models){for(const key of ['near','mid'])parts(model[key]).forEach(p=>{geometries.add(p.geometry);materials.add(p.material);materials.add(p.customDepthMaterial);});geometries.add(model.farGeometry);model.farMaterials.forEach(m=>materials.add(m));}for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());view.contactShade.dispose();view.renderer.dispose();});
