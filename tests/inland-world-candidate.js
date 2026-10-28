import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {WorldView} from '../src/scene.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {loadWoodlandDressing} from '../src/woodland.js';
import {prepareCoastalVisual,bindCoastalVisual} from '../src/coastal.js';
import {createWorld,terrain,ISLANDS,LANDMARKS,SPAWN} from '../src/world.js';
import {freshGame,nearest} from '../src/game.js';
const params=new URLSearchParams(location.search),loaded3DLevel=params.get('lod')==='mid'?'mid':'near';if(params.has('gpu'))document.body.classList.add('gpu');
const world=createWorld(),input=JSON.stringify(world.objects),canvas=document.querySelector('canvas'),out=document.querySelector('output'),view=new WorldView(canvas,world);
view.installAuthoredCast(await loadAuthoredCast());view.installWoodlandDressing(await loadWoodlandDressing(world.objects));view.coastal=bindCoastalVisual(view,await prepareCoastalVisual());
const selected=[];
for(const node of world.objects){
  if(node.type!=='tree'||Math.hypot(node.x-ISLANDS[1].x,node.z-ISLANDS[1].z)>100||node.y<4||node.y>34||LANDMARKS.some(l=>Math.hypot(node.x-l.x,node.z-l.z)<26)||Math.hypot(node.x-SPAWN.x,node.z-SPAWN.z)<40||selected.some(o=>Math.hypot(node.x-o.x,node.z-o.z)<32))continue;
  const slope=Math.hypot(terrain(node.x+.5,node.z)-terrain(node.x-.5,node.z),terrain(node.x,node.z+.5)-terrain(node.x,node.z-.5));if(slope>.7)continue;
  selected.push(node);
}
const ids=new Set(selected.map(o=>o.id)),layout=await(await fetch('../dist/inland-authored-candidate/impostor-layout.json')).json(),materials=[];
for(const frame of layout.frames){
  const textures=await Promise.all(['color','normal'].map(kind=>new THREE.TextureLoader().loadAsync(`../dist/inland-authored-candidate/impostors-r1/jacaranda_tree-${frame.index}-${kind}.png`)));
  textures[0].colorSpace=THREE.SRGBColorSpace;materials.push(new THREE.MeshStandardMaterial({map:textures[0],normalMap:textures[1],side:THREE.DoubleSide,alphaTest:.45,roughness:.9}));
}
const frame=layout.frames[0],plane=new THREE.PlaneGeometry(frame.width,frame.height),trees=[];
const geometryManifest=await(await fetch('../dist/inland-authored-component-candidate/geometry-manifest.json')).json(),single3DGeometryBytes=geometryManifest.models.jacaranda_tree.levels[loaded3DLevel].geometryBytes;
const sourceNear=(await new GLTFLoader().loadAsync(`../dist/inland-authored-component-candidate/jacaranda_tree/jacaranda_tree_${loaded3DLevel}.gltf`)).scene;
sourceNear.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
for(const node of selected){
  const root=new THREE.Group(),mesh=new THREE.Mesh(plane,materials[0]),near=sourceNear.clone(true);near.scale.setScalar(layout.unit);near.position.y=.146615132689476*layout.unit;near.visible=false;root.position.set(node.x,node.y,node.z);root.scale.setScalar(node.scale);root.rotation.y=node.rotation;mesh.position.fromArray(frame.center);mesh.position.y+=.146615132689476*layout.unit;root.add(mesh,near);view.scene.add(root);trees.push({node,root,mesh,near});
}
const replaced=[];for(const {batch,entries}of view.batches)for(let i=0;i<entries.length;i++)if(ids.has(entries[i].id)){const matrix=new THREE.Matrix4();batch.getMatrixAt(i,matrix);replaced.push({batch,index:i,matrix});}
const hidden=new THREE.Matrix4().makeScale(0,0,0);let state;
function draw(){
  const representation=document.querySelector('#representation').value,candidate=representation!=='old',chosen=representation==='mesh-candidate'?trees.filter(t=>Math.hypot(t.node.x-state.player.x,t.node.z-state.player.z)<12).sort((a,b)=>Math.hypot(a.node.x-state.player.x,a.node.z-state.player.z)-Math.hypot(b.node.x-state.player.x,b.node.z-state.player.z))[0]:null;
  for(const tree of trees){tree.root.visible=candidate;tree.near.visible=tree===chosen;tree.mesh.visible=tree!==chosen;}
  for(const row of replaced){row.batch.setMatrixAt(row.index,candidate?hidden:row.matrix);row.batch.instanceMatrix.needsUpdate=true;}
  view.draw(state,nearest(state,world.objects),null,false,1/60);
  for(const tree of trees){tree.root.visible=candidate;const angle=Math.atan2(view.camera.position.x-tree.node.x,view.camera.position.z-tree.node.z)-tree.node.rotation,index=((Math.round(angle/(Math.PI/2))%4)+4)%4;tree.mesh.rotation.y=index*Math.PI/2;tree.mesh.material=materials[index];}
  view.renderer.render(view.scene,view.camera);
  out.textContent=JSON.stringify({ready:true,representation,loaded3DLevel,single3DGeometryBytes,visible3DCount:chosen?1:0,visible3DId:chosen?.node.id??null,place:document.querySelector('#place').value,time:state.time,selectedIds:selected.map(o=>o.id),selectedCount:selected.length,selectedOriginalPositions:selected.map(o=>[o.id,o.x,o.y,o.z,o.scale]),originalWorldObjectsUnchanged:JSON.stringify(world.objects)===input,sharedHumanUnit:layout.unit,sourceOriginalHeight:19.46887503564358,camera:view.camera.position.toArray(),player:[state.player.x,state.player.z],originalCoastalIds:view.coastal.trees.length,render:{calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles},viewport:[innerWidth,innerHeight],buffer:[canvas.width,canvas.height],glError:view.renderer.getContext().getError(),scope:'Production world terrain/cast/coastal/woodland/follow camera, declared q6/axe location fixture.15 original inland IDs and unchanged positions/scales. At most one source-component3D tree within12; only one3D LOD loaded and geometries shared by clones. Four-view R1 far cards remain. Original collision/camera/body rules do not match mature wood. No ordinary save read/write, contact/gameplay/endurance/production integration or M5 acceptance.'});
}
function reset(){const place=document.querySelector('#place').value,[x,z]=place==='edge'?[132,-26]:place==='near-root'?[164,-92]:[154,-72];state=freshGame();Object.assign(state.player,{x,z});state.time=Number(document.querySelector('#light').value);state.quest=6;state.inventory.axe=1;state.selected='axe';view.yaw=.15;view.pitch=.18;view.player.userData.lastPosition=null;view.camera.position.set(x+5,Math.max(terrain(x,z),0)+12,z+20);view.sync(state);for(let i=0;i<60;i++)draw();}
for(const el of document.querySelectorAll('select'))el.onchange=reset;
await Promise.all([view.groundSurface.userData.ground.loaded,view.groundSurface.userData.ground.sand.loaded,view.rockSurface.userData.rock.loaded]);reset();
document.querySelector('#gpu').disabled=false;
window.addEventListener('resize',()=>{view.resize();if(state)draw();});
window.addEventListener('pagehide',()=>{view.coastal.release();view.authoredCast.release();view.woodlandDressing.release();view.contactShade.dispose();plane.dispose();for(const m of materials){m.map.dispose();m.normalMap.dispose();m.dispose();}view.renderer.dispose();});
// Native GPU interval around a static render only; no campaign, CPU game-loop or VRAM claim.
const gl=view.renderer.getContext(),extension=gl.getExtension('EXT_disjoint_timer_query_webgl2'),queries=new Set(),raf=()=>new Promise(requestAnimationFrame),gpuOut=document.querySelector('#gpu-result');
const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
document.querySelector('#gpu').onclick=async()=>{
 const controls=[...document.querySelectorAll('button,select')],rows=[];let hiddenPage=false,disjointCount=0;
 controls.forEach(c=>c.disabled=true);
 try{
  if(!extension)throw Error('No native GPU timer extension');view.resize();
  for(const representation of ['old','candidate','mesh-candidate']){
   document.querySelector('#place').value='near-root';document.querySelector('#representation').value=representation;reset();
   for(let i=0;i<40;i++){await raf();hiddenPage||=document.hidden;view.renderer.render(view.scene,view.camera);}
   const waiting=[],gpu=[],cpu=[];
   const read=()=>{if(gl.getParameter(extension.GPU_DISJOINT_EXT)){disjointCount++;throw Error('Disjoint GPU interval');}for(let i=waiting.length-1;i>=0;i--){const q=waiting[i];if(!gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE))continue;const n=gl.getQueryParameter(q.query,gl.QUERY_RESULT);if(!Number.isFinite(n)||n<=0)throw Error('Invalid native GPU value');gpu[q.index]=n/1e6;gl.deleteQuery(q.query);queries.delete(q.query);waiting.splice(i,1);}};
   for(let i=0;i<60;i++){
    await raf();hiddenPage||=document.hidden;read();const query=gl.createQuery();queries.add(query);const start=performance.now();gl.beginQuery(extension.TIME_ELAPSED_EXT,query);try{view.renderer.render(view.scene,view.camera);}finally{gl.endQuery(extension.TIME_ELAPSED_EXT);}cpu.push(performance.now()-start);waiting.push({query,index:i});
   }
   const started=performance.now();while(waiting.length){await raf();read();if(performance.now()-started>4000)throw Error('GPU query timeout');}
   const snapshot=JSON.parse(out.textContent);rows.push({representation,gpuRawMs:gpu,gpuMs:summary(gpu),cpuRenderMs:summary(cpu),visible3DCount:snapshot.visible3DCount,visible3DId:snapshot.visible3DId,camera:snapshot.camera,player:snapshot.player,triangles:view.renderer.info.render.triangles,drawCalls:view.renderer.info.render.calls,glError:gl.getError()});gpuOut.textContent=JSON.stringify({complete:false,rows});
  }
  const shared=new Set();sourceNear.traverse(o=>{if(o.isMesh)shared.add(o.geometry);});
  gpuOut.textContent=JSON.stringify({complete:true,supported:true,loaded3DLevel,single3DGeometryBytes,shared3DGeometries:shared.size,hidden:hiddenPage,disjointCount,rows,viewport:[innerWidth,innerHeight],buffer:[canvas.width,canvas.height],canvasCssSize:[canvas.clientWidth,canvas.clientHeight],timerBits:gl.getQuery(extension.TIME_ELAPSED_EXT,extension.QUERY_COUNTER_BITS_EXT),resourceLODs:[...new Set(performance.getEntriesByType('resource').flatMap(e=>e.name.includes('/inland-authored-component-candidate/')?[e.name.match(/jacaranda_tree_(near|mid)\.(?:gltf|bin)$/)?.[1]].filter(Boolean):[]))],jsHeapBytes:performance.memory?.usedJSHeapSize??null,scope:'Three declared static near-root scene fixtures,40 warm-up renders then60 native asynchronous GPU intervals around renderer.render per phase. Production terrain/cast/woodland/coastal plus candidate. Exactly one3D LOD loaded/shared; at most one visible mature3D tree. Renderer and shadow work included. No simulation/movement/contact/save/audio/VRAM/endurance or physical-device proof.'});
 }catch(error){gpuOut.textContent=JSON.stringify({complete:false,supported:Boolean(extension),hidden:hiddenPage,disjointCount,rows,error:error.message});console.error(error);}
 finally{for(const q of queries)gl.deleteQuery(q);queries.clear();controls.forEach(c=>c.disabled=false);}
};
window.addEventListener('pagehide',()=>{for(const q of queries)gl.deleteQuery(q);const geometries=new Set(),materials=new Set(),textures=new Set();sourceNear.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());});
