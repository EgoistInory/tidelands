// Whole-biome QA composition: existing mineral footprints plus sheltered low ground cover.
import * as THREE from '../vendor/three.module.min.js';
import {ISLANDS,LANDMARKS,terrain,randomGenerator} from '../src/world.js';
import {landscapeSample,landscapeMass} from '../src/landscape.js';
import {resourceHalfSize} from '../src/resource-contact.js';
import {isDepleted} from '../src/game.js';
import {seatMeadowRoots} from '../src/ground-support.js';
function segmentDistance(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);}
export function highlandGroundPlan(objects){
 const island=ISLANDS[2],anchors=objects.filter(o=>o.type==='tree'&&landscapeSample(o.x,o.z).biome===2),random=randomGenerator(311028),ferns=[],routes=LANDMARKS.filter(o=>Math.hypot(o.x-island.x,o.z-island.z)<island.r).map(o=>[o,island]);
 for(const anchor of anchors)for(let i=0;i<18&&ferns.length<200;i++){
  const angle=random()*Math.PI*2,r=4+random()*11,x=anchor.x+Math.sin(angle)*r,z=anchor.z+Math.cos(angle)*r,y=terrain(x,z),slope=Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5));
  const bowl=terrain(x+3,z)+terrain(x-3,z)+terrain(x,z+3)+terrain(x,z-3)-4*y;
  if(landscapeSample(x,z).biome!==2||y<7||y>36||slope>.7||bowl<.05||landscapeMass(x,z)<.24)continue;
  if(LANDMARKS.some(o=>Math.hypot(o.x-x,o.z-z)<12)||routes.some(([a,b])=>segmentDistance(x,z,a,b)<4))continue;
  if(objects.some(o=>Math.hypot(o.x-x,o.z-z)<(o.type==='tree'?3.5:resourceHalfSize(o)+1.5)))continue;
  if(ferns.some(o=>Math.hypot(o.x-x,o.z-z)<1.1))continue;
  ferns.push({x,z,height:.25+random()*.3,rotation:random()*Math.PI*2,variant:Math.floor(random()*4)});
 }
 return {minerals:objects.filter(o=>['stone','crystal'].includes(o.type)&&landscapeSample(o.x,o.z).biome===2),ferns};
}
export function createHighlandGroundCandidate(view){
 const plan=highlandGroundPlan(view.world.objects),root=new THREE.Group(),ownedMaterials=[],batches=[],hidden=new THREE.Matrix4().makeScale(0,0,0),saved=[],dummy=new THREE.Object3D();root.name='highland-ground-candidate';root.visible=false;view.scene.add(root);
 const templates=kind=>[...new Map(view.woodlandDressing.root.children.filter(m=>m.name==='woodland-'+kind).map(m=>[m.geometry.uuid,m])).values()];
 const rocks=templates('moss'),ferns=templates('fern');if(rocks.length!==6||ferns.length!==4)throw Error('Expected the existing six rock/four fern source variants');
 const ids=new Set(plan.minerals.filter(n=>n.type==='stone').map(n=>n.id));for(const record of view.batches)if(record.batch.visible!==false)record.entries.forEach((node,i)=>{if(ids.has(node.id)){const matrix=new THREE.Matrix4();record.batch.getMatrixAt(i,matrix);saved.push({record,node,i,matrix});}});
 function batch(template,rows,kind){if(!rows.length)return;const material=kind==='rock'?template.material.clone():template.material;if(kind==='rock'){material.onBeforeCompile=()=>{};ownedMaterials.push(material);}const mesh=new THREE.InstancedMesh(template.geometry,material,rows.length);mesh.name='highland-'+kind;mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=kind==='rock'?new THREE.MeshDepthMaterial():template.customDepthMaterial;if(kind==='rock')ownedMaterials.push(mesh.customDepthMaterial);
  const matrices=[];for(const row of rows){const node=row.node;let size=row.height,yaw=row.rotation;if(node){yaw=node.rotation;const box=template.geometry.boundingBox,c=Math.cos(yaw),s=Math.sin(yaw),extent=Math.max(...[box.min.x,box.max.x].flatMap(x=>[box.min.z,box.max.z].flatMap(z=>[Math.abs(c*x+s*z),Math.abs(-s*x+c*z)])));size=Math.min(resourceHalfSize(node)*.9/extent,(node.type==='crystal'?.6:1.9)*node.scale);}
   dummy.position.set(row.x,terrain(row.x,row.z),row.z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(size);dummy.updateMatrix();const matrix=dummy.matrix.clone();seatMeadowRoots(template.geometry,[matrix],view.groundHeight);matrices.push(matrix);mesh.setMatrixAt(matrices.length-1,matrix);
  }mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);batches.push({mesh,rows,matrices});
 }
 rocks.forEach((template,i)=>batch(template,plan.minerals.filter(n=>Number(n.id.match(/\d+/)[0])%6===i).map(node=>({node,x:node.x,z:node.z})),'rock'));
 ferns.forEach((template,i)=>batch(template,plan.ferns.filter(p=>p.variant===i),'fern'));
 let enabled=false,released=false,lastState=null;function afterSync(state=lastState){if(state)lastState=state;if(!enabled||released)return;for(const {record,i}of saved){record.batch.setMatrixAt(i,hidden);record.batch.instanceMatrix.needsUpdate=true;}}
 function setEnabled(value){if(released)throw Error('Ground candidate released');enabled=value;root.visible=value;if(enabled)afterSync();else for(const {record,node,i,matrix}of saved){record.batch.setMatrixAt(i,lastState&&isDepleted(lastState,node)?hidden:matrix);record.batch.instanceMatrix.needsUpdate=true;}}
 function update(state){lastState=state;if(!enabled||released)return;afterSync();for(const b of batches){b.rows.forEach((row,i)=>{const absent=row.node?isDepleted(state,row.node):state.buildings.some(o=>Math.hypot(o.x-row.x,o.z-row.z)<(o.type==='tent'?4.2:3.1));b.mesh.setMatrixAt(i,absent?hidden:b.matrices[i]);});b.mesh.instanceMatrix.needsUpdate=true;}}
 return {root,plan,batches,afterSync,update,setEnabled,get enabled(){return enabled;},release(){if(released)return;setEnabled(false);released=true;for(const b of batches)b.mesh.dispose();ownedMaterials.forEach(m=>m.dispose());root.removeFromParent();root.clear();}};
}
