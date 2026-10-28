import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {loadWoodlandDressing} from '../src/woodland.js';
import {prepareCoastalVisual,bindCoastalVisual} from '../src/coastal.js';
import {createWorld,terrain,ISLANDS,LANDMARKS,SPAWN} from '../src/world.js';
import {freshGame,nearest} from '../src/game.js';
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
for(const node of selected){
  const root=new THREE.Group(),mesh=new THREE.Mesh(plane,materials[0]);root.position.set(node.x,node.y,node.z);root.scale.setScalar(node.scale);root.rotation.y=node.rotation;mesh.position.fromArray(frame.center);mesh.position.y+=.146615132689476*layout.unit;root.add(mesh);view.scene.add(root);trees.push({node,root,mesh});
}
const replaced=[];for(const {batch,entries}of view.batches)for(let i=0;i<entries.length;i++)if(ids.has(entries[i].id)){const matrix=new THREE.Matrix4();batch.getMatrixAt(i,matrix);replaced.push({batch,index:i,matrix});}
const hidden=new THREE.Matrix4().makeScale(0,0,0);let state;
function draw(){
  const candidate=document.querySelector('#representation').value==='candidate';
  for(const row of replaced){row.batch.setMatrixAt(row.index,candidate?hidden:row.matrix);row.batch.instanceMatrix.needsUpdate=true;}
  view.draw(state,nearest(state,world.objects),null,false,1/60);
  for(const tree of trees){tree.root.visible=candidate;const angle=Math.atan2(view.camera.position.x-tree.node.x,view.camera.position.z-tree.node.z)-tree.node.rotation,index=((Math.round(angle/(Math.PI/2))%4)+4)%4;tree.mesh.rotation.y=index*Math.PI/2;tree.mesh.material=materials[index];}
  view.renderer.render(view.scene,view.camera);
  out.textContent=JSON.stringify({ready:true,representation:candidate?'candidate':'old',place:document.querySelector('#place').value,time:state.time,selectedIds:selected.map(o=>o.id),selectedCount:selected.length,selectedOriginalPositions:selected.map(o=>[o.id,o.x,o.y,o.z,o.scale]),originalWorldObjectsUnchanged:JSON.stringify(world.objects)===input,sharedHumanUnit:layout.unit,sourceOriginalHeight:19.46887503564358,camera:view.camera.position.toArray(),player:[state.player.x,state.player.z],originalCoastalIds:view.coastal.trees.length,render:{calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles},viewport:[innerWidth,innerHeight],buffer:[canvas.width,canvas.height],glError:view.renderer.getContext().getError(),scope:'Production world terrain/cast/coastal/woodland/follow camera, declared q6/axe location fixture. Fixed subset of original inland IDs and original positions/scales; only diagnostic instance matrices hidden. Baked four-view candidate only; original collision/camera/body rules are unchanged and do not match the mature woody shape. No ordinary save read/write, contact/gameplay/GPU/endurance/production integration or M5 acceptance.'});
}
function reset(){const [x,z]=document.querySelector('#place').value==='edge'?[132,-26]:[154,-72];state=freshGame();Object.assign(state.player,{x,z});state.time=Number(document.querySelector('#light').value);state.quest=6;state.inventory.axe=1;state.selected='axe';view.yaw=.15;view.pitch=.18;view.player.userData.lastPosition=null;view.camera.position.set(x+5,Math.max(terrain(x,z),0)+12,z+20);view.sync(state);for(let i=0;i<60;i++)draw();}
for(const el of document.querySelectorAll('select'))el.onchange=reset;
await Promise.all([view.groundSurface.userData.ground.loaded,view.groundSurface.userData.ground.sand.loaded,view.rockSurface.userData.rock.loaded]);reset();
window.addEventListener('resize',()=>{view.resize();if(state)draw();});
window.addEventListener('pagehide',()=>{view.coastal.release();view.authoredCast.release();view.woodlandDressing.release();view.contactShade.dispose();plane.dispose();for(const m of materials){m.map.dispose();m.normalMap.dispose();m.dispose();}view.renderer.dispose();});
