// Declared local main-path fixture; no production import or ordinary storage access.
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {terrain} from '../src/world.js';
import {isDepleted} from '../src/game.js';
import {registerFootprint} from '../src/resource-footprint.js';
const parts=root=>{const out=[];root.traverse(o=>{if(o.isMesh)out.push(o);});return out;};
const json=async path=>{const r=await fetch(new URL(path,import.meta.url));if(!r.ok)throw Error(`Local candidate unavailable: ${path}`);return r.json();};
export async function prepareInlandContacts(level='near'){
  if(!['near','mid'].includes(level))throw Error('Unknown LOD');
  const data=await json('../dist/inland-authored-contact-candidate/inland-contact-shapes.json'),layout=await json('../dist/inland-authored-candidate/impostor-layout.json'),resources=[];
  const release=()=>{const geoms=new Set(),mats=new Set(),textures=new Set();for(const root of resources)parts(root).forEach(p=>{geoms.add(p.geometry);mats.add(p.material);if(p.customDepthMaterial)mats.add(p.customDepthMaterial);});for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}geoms.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());};
  try{
    const model=(await new GLTFLoader().loadAsync(new URL(`../dist/inland-authored-component-candidate/jacaranda_tree/jacaranda_tree_${level}.gltf`,import.meta.url).href)).scene;resources.push(model);
    parts(model).forEach(p=>{p.castShadow=p.receiveShadow=true;});
    const materials=[],loader=new THREE.TextureLoader();
    for(let i=0;i<4;i++){const maps=[];for(const kind of ['color','normal'])maps.push(await loader.loadAsync(new URL(`../dist/inland-authored-candidate/impostors-r1/jacaranda_tree-${i}-${kind}.png`,import.meta.url).href));maps[0].colorSpace=THREE.SRGBColorSpace;materials.push(new THREE.MeshStandardMaterial({map:maps[0],normalMap:maps[1],side:THREE.DoubleSide,alphaTest:.45,roughness:.9}));}
    const plane=new THREE.PlaneGeometry(layout.frames[0].width/data.unit,layout.frames[0].height/data.unit);for(const material of materials)resources.push(new THREE.Mesh(plane,material));
    return {data,layout,model,plane,materials,level,release};
  }catch(error){release();throw error;}
}
export function bindInlandContacts(view,prepared){
  const {data}=prepared,ids=new Set(data.placements.map(p=>p.id)),trees=[],cameraRecords=[],hidden=new THREE.Matrix4().makeScale(0,0,0);
  // Validate every pose and camera chunk before binding the physics WeakMap.
  for(const placement of data.placements){
    const node=view.world.objects.find(o=>o.id===placement.id);if(!node||JSON.stringify([node.x,node.y,node.z,node.scale,node.rotation])!==JSON.stringify(placement.pose))throw Error('Candidate pose changed');
    const f=placement.frame,matrix=new THREE.Matrix4().compose(new THREE.Vector3(f.x,f.y,f.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),f.rotation),new THREE.Vector3(f.scale,f.scale,f.scale)),chunks=new Map();
    for(const [min,max]of data.cameraBoxes){const key=[Math.floor((min[0]+max[0])/4),Math.floor((min[2]+max[2])/4)].join(',');if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max)).applyMatrix4(matrix));}
    const records=[];for(const boxes of chunks.values()){
      const bounds=new THREE.Box3();boxes.forEach(b=>bounds.union(b));const c=bounds.getCenter(new THREE.Vector3()),radius=Math.hypot(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/2;if(radius>=12)throw Error('Camera chunk exceeds core culling allowance');
      records.push({object:{id:node.id,type:'inland-camera',x:c.x,z:c.z},boxes,originalBoxes:boxes,radius});
    }cameraRecords.push(...records);trees.push({node,frame:f,records});
  }
  for(const t of trees){
    registerFootprint(t.node,data.bodyBoxes,terrain,t.frame);
    const root=new THREE.Group();root.position.set(t.frame.x,t.frame.y,t.frame.z);root.rotation.y=t.frame.rotation;root.scale.setScalar(t.frame.scale);
    const near=prepared.model.clone(true),far=new THREE.Mesh(prepared.plane,prepared.materials[0]);far.position.fromArray(prepared.layout.frames[0].center.map(v=>v/data.unit));root.add(near,far);view.scene.add(root);Object.assign(t,{root,near,far});
  }
  const instances=[];for(const {batch,entries}of view.batches)for(let i=0;i<entries.length;i++)if(ids.has(entries[i].id))instances.push({batch,i});
  view.cameraObstacles=[...view.cameraObstacles.filter(r=>!ids.has(r.object.id)),...cameraRecords];
  const afterSync=()=>{for(const {batch,i}of instances){const at=i*16,a=batch.instanceMatrix.array;if(a[at]!==0||a[at+5]!==0||a[at+10]!==0){batch.setMatrixAt(i,hidden);batch.instanceMatrix.needsUpdate=true;}}};
  return {trees,cameraRecords,afterSync,update(state){
    const chosen=trees.filter(t=>!isDepleted(state,t.node)&&Math.hypot(t.node.x-state.player.x,t.node.z-state.player.z)<12).sort((a,b)=>Math.hypot(a.node.x-state.player.x,a.node.z-state.player.z)-Math.hypot(b.node.x-state.player.x,b.node.z-state.player.z))[0];
    for(const t of trees){const active=!isDepleted(state,t.node);t.root.visible=active&&Math.hypot(t.node.x-state.player.x,t.node.z-state.player.z)<260;t.near.visible=t===chosen;t.far.visible=t!==chosen;for(const r of t.records)r.boxes=active?r.originalBoxes:[];const angle=Math.atan2(view.camera.position.x-t.node.x,view.camera.position.z-t.node.z)-t.node.rotation,index=((Math.round(angle/(Math.PI/2))%4)+4)%4;t.far.rotation.y=index*Math.PI/2;t.far.material=prepared.materials[index];}
  }};
}
