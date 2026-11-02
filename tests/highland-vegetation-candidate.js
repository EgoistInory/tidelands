// Isolated whole-biome candidate; borrows the already licensed coastal model library.
import * as THREE from '../vendor/three.module.min.js';
import {terrain} from '../src/world.js';
import {islandTreeAppearance} from '../src/landscape.js';
import {isDepleted} from '../src/game.js';
import {registerFootprint,footprintBoxes} from '../src/resource-footprint.js';
import {coastalBudgetLevels} from '../src/coastal-level-budget.js';
import {createCoastalFarBatches} from '../src/coastal-far-batches.js';
const meshes=root=>{const a=[];root.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
export function createHighlandVegetationCandidate(view,prepared){
 const nodes=view.world.objects.filter(n=>n.type==='tree'&&islandTreeAppearance(n).form==='highland'),ids=new Set(nodes.map(n=>n.id)),hidden=new THREE.Matrix4().makeScale(0,0,0),instances=[],trees=[],originalObstacles=view.cameraObstacles;
 for(const record of view.batches)if(record.batch.visible!==false)record.entries.forEach((node,i)=>{if(ids.has(node.id)){const matrix=new THREE.Matrix4();record.batch.getMatrixAt(i,matrix);instances.push({record,node,i,matrix});}});
 for(const node of nodes){
  const model=prepared.models[Number(node.id.match(/\d+/)?.[0]??0)%prepared.models.length],scale=node.scale*prepared.unit*islandTreeAppearance(node).height,frame={x:node.x,y:node.y-model.minY*scale,z:node.z,rotation:node.rotation,scale},root=new THREE.Group();root.position.set(frame.x,frame.y,frame.z);root.rotation.y=frame.rotation;root.scale.setScalar(scale);
  const near=model.near.clone(true),mid=model.mid.clone(true),far=new THREE.Mesh(model.farGeometry,model.farMaterials[0]);far.position.set(model.center.x,0,model.center.z);
  for(const [level,clone]of [['near',near],['mid',mid]])meshes(clone).forEach((p,i)=>p.customDepthMaterial=meshes(model[level])[i].customDepthMaterial);
  root.add(near,mid,far);root.visible=false;view.scene.add(root);trees.push({node,model,frame,root,near,mid,far,level:'hidden'});
 }
 const batches=createCoastalFarBatches(THREE,view.scene,trees);let enabled=false,released=false,state=null,unregister=[];
 function afterSync(next=state){if(next)state=next;if(!enabled||released)return;for(const {record,i}of instances){record.batch.setMatrixAt(i,hidden);record.batch.instanceMatrix.needsUpdate=true;}}
 function setEnabled(next){
  if(released)throw Error('Candidate already released');if(next===enabled)return;enabled=next;
  if(enabled){try{for(const t of trees){if(footprintBoxes(t.node))throw Error('Highland footprint already owned');unregister.push(registerFootprint(t.node,t.model.boxes,terrain,t.frame));}}catch(e){unregister.forEach(f=>f());unregister=[];enabled=false;throw e;}
   view.cameraObstacles=[...originalObstacles.filter(r=>!ids.has(r.object.id)),...trees.map(t=>({object:t.node,boxes:footprintBoxes(t.node).map(([min,max])=>new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max)))}))];afterSync();
  }else{unregister.forEach(f=>f());unregister=[];view.cameraObstacles=originalObstacles;for(const {record,node,i,matrix}of instances){record.batch.setMatrixAt(i,state&&isDepleted(state,node)?hidden:matrix);record.batch.instanceMatrix.needsUpdate=true;}for(const t of trees){t.root.visible=false;t.level='hidden';}batches.update();}
 }
 function update(next){state=next;if(!enabled||released)return;afterSync();const depleted=new Set(nodes.filter(n=>isDepleted(state,n)).map(n=>n.id)),levels=new Map(coastalBudgetLevels(nodes,state.player,depleted).map(r=>[r.id,r.level]));
  for(const t of trees){t.level=levels.get(t.node.id);t.root.visible=t.level!=='hidden';t.near.visible=t.level==='near';t.mid.visible=t.level==='mid';t.far.visible=false;const angle=Math.atan2(view.camera.position.x-t.node.x,view.camera.position.z-t.node.z)-t.node.rotation;t.farFrame=((Math.round(angle/(Math.PI/2))%4)+4)%4;t.far.rotation.y=t.farFrame*Math.PI/2;t.far.material=t.model.farMaterials[t.farFrame];}batches.update();
 }
 return {nodes,trees,afterSync,update,setEnabled,get enabled(){return enabled;},release(){if(released)return;if(enabled)setEnabled(false);released=true;batches.release();for(const t of trees)view.scene.remove(t.root);}};
}
