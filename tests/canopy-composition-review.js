import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {loadWoodlandDressing} from '../src/woodland.js';
import {createWorld,terrain} from '../src/world.js';
import {islandTreeAppearance} from '../src/landscape.js';
import {mergeStaticParts} from '../src/merge-parts.js';
import {freshGame,nearest} from '../src/game.js';
import {classifyTrees,createCompositionTree} from './canopy-composition-candidate.js';
const world=createWorld(),frozen=JSON.stringify(world),view=new WorldView(document.querySelector('canvas'),world),output=document.querySelector('output'),dummy=new THREE.Object3D();
const originalTrees=view.batches.filter(b=>b.entries[0]?.type==='tree'),originalObstacles=view.cameraObstacles,candidateObstacles=originalObstacles.filter(b=>b.object.type!=='tree'),candidateTrees=[],cohorts=classifyTrees(world.objects),groups=new Map();
for(const row of cohorts){const key=row.form+':'+row.cohort;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
function transform(node){const appearance=islandTreeAppearance(node);dummy.position.set(node.x,node.y,node.z);dummy.scale.set(node.scale,Math.max(.95,node.scale*appearance.height),node.scale);dummy.rotation.set(0,node.rotation,0);dummy.updateMatrix();return dummy.matrix.clone();}
for(const [key,rows] of groups){
  const [form,cohort]=key.split(':'),model=createCompositionTree(form,cohort);model.updateMatrixWorld(true);
  const bounds=model.children.map(part=>new THREE.Box3().setFromObject(part));
  for(const {node}of rows){const matrix=transform(node);candidateObstacles.push({object:node,boxes:bounds.map(box=>box.clone().applyMatrix4(matrix))});}
  mergeStaticParts(model);model.updateMatrixWorld(true);
  for(const part of model.children){
    const batch=new THREE.InstancedMesh(part.geometry,part.material,rows.length);batch.customDepthMaterial=part.customDepthMaterial;batch.castShadow=batch.receiveShadow=true;batch.visible=false;
    rows.forEach(({node},i)=>{batch.setMatrixAt(i,transform(node).multiply(part.matrix));if(part.material.alphaTest>0)batch.setColorAt(i,islandTreeAppearance(node).tint);});
    batch.computeBoundingSphere();batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);view.scene.add(batch);
    const record={batch,entries:rows.map(r=>r.node),part:part.matrix.clone(),hidden:new Set()};candidateTrees.push(record);view.batches.push(record);
  }
}
let state;const places={coast:[-90,140],grove:[202,-39],vista:[92,-8],highland:[-75,-175],shoal:[190,248],camp:[-80,98]};
function draw(){view.draw(state,nearest(state,world.objects),null,false,1/60);const info=view.renderer.info;output.textContent=JSON.stringify({ready:true,art:document.querySelector('#art').value,scene:document.querySelector('#scene').value,position:[state.player.x,state.player.z],time:state.time,camera:view.camera.position.toArray(),requestedCamera:{yaw:.15,pitch:.29},worldUnchanged:JSON.stringify(world)===frozen,cohorts:Object.fromEntries(['retained','mature','edge','young'].map(c=>[c,cohorts.filter(r=>r.cohort===c).length])),candidateBatches:candidateTrees.length,treeNodes:cohorts.length,render:{calls:info.render.calls,triangles:info.render.triangles,textures:info.memory.textures,geometries:info.memory.geometries},viewport:[innerWidth,innerHeight],buffer:[view.canvas.width,view.canvas.height],glError:view.renderer.getContext().getError(),scope:'Declared static positions/q6/time/night camp. Both groups resident. Candidate cameras use actual transformed tree part bounds; body rules and world nodes unchanged. No ordinary journey, GPU/endurance, precise net memory, motion or M5 acceptance.'});}
function reset(){const name=document.querySelector('#scene').value,[x,z]=places[name],candidate=document.querySelector('#art').value==='candidate';state=freshGame();Object.assign(state.player,{x,z});state.quest=6;state.time=name==='camp'?0:240;if(name==='camp')state.buildings=[{id:'canopy-qa-fire',type:'campfire',x:-80,z:104}];
  originalTrees.forEach(r=>r.batch.visible=!candidate);candidateTrees.forEach(r=>r.batch.visible=candidate);view.cameraObstacles=candidate?candidateObstacles:originalObstacles;
  view.yaw=.15;view.pitch=.29;view.camera.position.set(x+5,Math.max(terrain(x,z),0)+12,z+20);view.player.userData.lastPosition=null;view.player.userData.worldFeet=null;view.sync(state);for(let i=0;i<60;i++)draw();
}
Promise.all([loadAuthoredCast().then(c=>view.installAuthoredCast(c)),loadWoodlandDressing(world.objects).then(d=>view.installWoodlandDressing(d)),view.groundSurface.userData.ground.loaded,view.groundSurface.userData.ground.sand.loaded,view.rockSurface.userData.rock.loaded]).then(()=>{reset();document.querySelectorAll('select').forEach(e=>e.disabled=false);}).catch(e=>{console.error(e);output.textContent='失败：'+e.message;});
document.querySelectorAll('select').forEach(e=>e.onchange=reset);window.addEventListener('resize',()=>{view.resize();if(state)draw();});
window.addEventListener('pagehide',()=>{view.woodlandDressing?.release();view.authoredCast?.release();for(const row of candidateTrees)row.batch.geometry.dispose();view.contactShade.dispose();view.renderer.dispose();});
