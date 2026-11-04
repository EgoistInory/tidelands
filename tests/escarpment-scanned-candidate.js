// Regional masses use the six already licensed local scanned rocks, outside resource ownership.
import * as THREE from '../vendor/three.module.min.js';
import {terrain} from '../src/world.js';
import {escarpmentPlan,escarpmentOverlaps} from './escarpment-candidate.js';
export function createScannedEscarpmentCandidate(view){
 const plan=escarpmentPlan(view.world.objects),root=new THREE.Group(),materials=[];root.name='regional-scanned-escarpments';root.visible=false;
 const templates=[...new Map(view.woodlandDressing.root.children.filter(m=>m.name==='woodland-moss').map(m=>[m.geometry.uuid,m])).values()];if(templates.length!==6)throw Error('Six local scanned rock variants required');
 const meshes=plan.map((p,i)=>{
  const source=templates[i%templates.length],geometry=source.geometry,box=geometry.boundingBox,size=box.getSize(new THREE.Vector3()),a=geometry.attributes.position;
  let ellipse=1;for(let n=0;n<a.count;n++)ellipse=Math.max(ellipse,Math.hypot(a.getX(n)*2/size.x,a.getZ(n)*2/size.z));
  const constrain=Math.max(1,ellipse/1.04),c=Math.cos(p.rotation),s=Math.sin(p.rotation),heights=Array.from({length:16},(_,k)=>{const t=k/16*Math.PI*2,u=Math.cos(t)*p.length,v=Math.sin(t)*p.width;return terrain(p.x+c*u+s*v,p.z-s*u+c*v);}),base=Math.min(...heights)-.8,top=terrain(p.x,p.z)+p.height;
  const material=source.material.clone();material.onBeforeCompile=()=>{};material.customProgramCacheKey=()=> 'scanned-regional-bedrock-v1';materials.push(material);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(p.x,base,p.z);mesh.rotation.y=p.rotation;mesh.scale.set(p.length*2/size.x/constrain,(top-base)/size.y,p.width*2/size.z/constrain);mesh.updateMatrixWorld(true);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.placement=p;root.add(mesh);return mesh;
 });view.scene.add(root);let released=false;
 return {root,plan,meshes,setEnabled(v){root.visible=v;},update(state){for(const m of meshes)m.visible=!state.buildings.some(b=>escarpmentOverlaps(m.userData.placement,b,b.type==='tent'?4.2:3.1));},release(){if(released)return;released=true;root.removeFromParent();materials.forEach(m=>m.dispose());root.clear();}};
}
