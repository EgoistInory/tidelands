// Local authored inland trees; original world records and shared geometry stay intact.
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {terrain} from '../src/world.js';
import {isDepleted} from '../src/game.js';
import {registerFootprint,footprintBoxes} from './resource-footprint.js';
const assetRoot=new URL('../assets/inland/',import.meta.url),boundViews=new WeakSet();
const parts=root=>{const out=[];root.traverse(o=>{if(o.isMesh)out.push(o);});return out;};
export async function prepareInlandVisual({level='near',signal}={}){
  if(!['near','mid'].includes(level))throw Error('Unknown LOD');
  const resources=[],extraTextures=new Set(),extraMaterials=new Set();let released=false;
  const check=()=>{if(signal?.aborted)throw new DOMException('准备已中断','AbortError');};
  const json=async name=>{const r=await fetch(new URL(name,assetRoot),{signal});if(!r.ok)throw Error('林木资料加载失败');return r.json();};
  const release=()=>{if(released)return;released=true;const geoms=new Set(),mats=new Set(extraMaterials),textures=new Set(extraTextures);for(const root of resources)parts(root).forEach(p=>{geoms.add(p.geometry);mats.add(p.material);if(p.customDepthMaterial)mats.add(p.customDepthMaterial);});for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}geoms.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());};
  try{
    check();const data=await json('inland-contact-shapes.json'),layout=await json('impostor-layout.json');check();
    const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const parsed=new URL(url,assetRoot);if(parsed.origin!==assetRoot.origin||!parsed.pathname.startsWith(assetRoot.pathname))throw Error('Inland assets must remain local');return url;});
    const model=(await new GLTFLoader(manager).loadAsync(new URL(`jacaranda_tree/jacaranda_tree_${level}.gltf`,assetRoot).href)).scene;resources.push(model);check();if(!parts(model).length)throw Error('林木模型为空');
    parts(model).forEach(p=>{p.castShadow=p.receiveShadow=true;});
    const materials=[],loader=new THREE.TextureLoader(manager);
    for(let i=0;i<4;i++){const maps=[];for(const kind of ['color','normal']){const map=await loader.loadAsync(new URL(`impostors-r1/jacaranda_tree-${i}-${kind}.png`,assetRoot).href);extraTextures.add(map);maps.push(map);check();}maps[0].colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshStandardMaterial({map:maps[0],normalMap:maps[1],side:THREE.DoubleSide,alphaTest:.45,roughness:.9});extraMaterials.add(material);materials.push(material);}
    const plane=new THREE.PlaneGeometry(layout.frames[0].width/data.unit,layout.frames[0].height/data.unit);for(const material of materials)resources.push(new THREE.Mesh(plane,material));
    check();return {data,layout,model,plane,materials,level,release,get released(){return released;}};
  }catch(error){release();throw error;}
}
export function bindInlandVisual(view,prepared){
  if(boundViews.has(view))throw Error('Inland view already bound');if(prepared.released)throw Error('Inland resources already released');
  const {data}=prepared,ids=new Set(data.placements.map(p=>p.id)),trees=[],cameraRecords=[],hidden=new THREE.Matrix4().makeScale(0,0,0);
  for(const boxes of [data.bodyBoxes,data.cameraBoxes])if(!Array.isArray(boxes)||!boxes.length||boxes.length>10000||boxes.some(b=>!Array.isArray(b)||b.length!==2||b.some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))||b[0].some((v,i)=>v>=b[1][i])))throw Error('Invalid inland contact boxes');
  // Validate every pose and camera chunk before binding the physics WeakMap.
  for(const placement of data.placements){
    const node=view.world.objects.find(o=>o.id===placement.id);if(!node||JSON.stringify([node.x,node.y,node.z,node.scale,node.rotation])!==JSON.stringify(placement.pose))throw Error('Inland pose changed');if(footprintBoxes(node))throw Error('Inland resource already bound');
    const f=placement.frame,matrix=new THREE.Matrix4().compose(new THREE.Vector3(f.x,f.y,f.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),f.rotation),new THREE.Vector3(f.scale,f.scale,f.scale)),chunks=new Map();
    for(const [min,max]of data.cameraBoxes){const key=[Math.floor((min[0]+max[0])/4),Math.floor((min[2]+max[2])/4)].join(',');if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max)).applyMatrix4(matrix));}
    const records=[];for(const boxes of chunks.values()){
      const bounds=new THREE.Box3();boxes.forEach(b=>bounds.union(b));const c=bounds.getCenter(new THREE.Vector3()),radius=Math.hypot(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/2;if(radius>=12)throw Error('Camera chunk exceeds core culling allowance');
      records.push({object:{id:node.id,type:'inland-camera',x:c.x,z:c.z},boxes,originalBoxes:boxes,radius});
    }cameraRecords.push(...records);trees.push({node,frame:f,records});
  }
  for(const t of trees){
    const root=new THREE.Group();root.position.set(t.frame.x,t.frame.y,t.frame.z);root.rotation.y=t.frame.rotation;root.scale.setScalar(t.frame.scale);
    const near=prepared.model.clone(true),far=new THREE.Mesh(prepared.plane,prepared.materials[0]);far.position.fromArray(prepared.layout.frames[0].center.map(v=>v/data.unit));root.add(near,far);Object.assign(t,{root,near,far});
  }
  const unregister=[];try{for(const t of trees)unregister.push(registerFootprint(t.node,data.bodyBoxes,terrain,t.frame));}catch(error){unregister.forEach(release=>release());throw error;}
  const instances=[];for(const record of view.batches)if(record.batch.visible!==false)for(let i=0;i<record.entries.length;i++)if(ids.has(record.entries[i].id)){const matrix=new THREE.Matrix4();record.batch.getMatrixAt(i,matrix);instances.push({record,batch:record.batch,node:record.entries[i],i,matrix});}
  const originalObstacles=view.cameraObstacles;let released=false,lastState=null;trees.forEach(t=>view.scene.add(t.root));boundViews.add(view);
  view.cameraObstacles=[...view.cameraObstacles.filter(r=>!ids.has(r.object.id)),...cameraRecords];
  const afterSync=state=>{if(released)return;if(state)lastState=state;for(const {batch,i}of instances){const at=i*16,a=batch.instanceMatrix.array;if(a[at]!==0||a[at+5]!==0||a[at+10]!==0){batch.setMatrixAt(i,hidden);batch.instanceMatrix.needsUpdate=true;}}};
  return {trees,cameraRecords,afterSync,release(){if(released)return;released=true;unregister.forEach(release=>release());trees.forEach(t=>view.scene.remove(t.root));view.cameraObstacles=originalObstacles;boundViews.delete(view);for(const {record,batch,node,i,matrix}of instances){const depleted=lastState?isDepleted(lastState,node):record.hidden.has(i);batch.setMatrixAt(i,depleted?hidden:matrix);depleted?record.hidden.add(i):record.hidden.delete(i);batch.instanceMatrix.needsUpdate=true;}
    // Rebuild via the existing resource transform, including a regrown saved resource.
    if(lastState&&typeof view.sync==='function'){for(const {record,node,i}of instances)isDepleted(lastState,node)?record.hidden.delete(i):record.hidden.add(i);view.sync(lastState);}prepared.release();
  },update(state){if(released)return;lastState=state;
    const chosen=trees.filter(t=>!isDepleted(state,t.node)&&Math.hypot(t.node.x-state.player.x,t.node.z-state.player.z)<12).sort((a,b)=>Math.hypot(a.node.x-state.player.x,a.node.z-state.player.z)-Math.hypot(b.node.x-state.player.x,b.node.z-state.player.z))[0];
    for(const t of trees){const active=!isDepleted(state,t.node);t.root.visible=active&&Math.hypot(t.node.x-state.player.x,t.node.z-state.player.z)<260;t.near.visible=t===chosen;t.far.visible=t!==chosen;for(const r of t.records)r.boxes=active?r.originalBoxes:[];const angle=Math.atan2(view.camera.position.x-t.node.x,view.camera.position.z-t.node.z)-t.node.rotation,index=((Math.round(angle/(Math.PI/2))%4)+4)%4;t.far.rotation.y=index*Math.PI/2;t.far.material=prepared.materials[index];}
  }};
}
