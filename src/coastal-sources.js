const base=new URL('../',import.meta.url);
const THREE=await import(new URL('vendor/three.module.min.js',base));
const {GLTFLoader}=await import(new URL('vendor/addons/loaders/GLTFLoader.js',base));
const {terrain,SPAWN,LANDMARKS}=await import(new URL('src/world.js',base));
const {islandTreeAppearance}=await import(new URL('src/landscape.js',base));
const {isDepleted}=await import(new URL('src/game.js',base));
const {registerFootprint,footprintBoxes,mergeFootprintCells}=await import(new URL('src/resource-footprint.js',base));
const assetRoot=new URL('../assets/coastal/',import.meta.url),UNIT=2.95/1.8195863831788301;
const parts=root=>{const a=[];root.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
export async function prepareCoastalVisual({signal}={}){
  const models=[],roots=[],extraTextures=[],manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const parsed=new URL(url,assetRoot);if(parsed.origin!==assetRoot.origin||!parsed.pathname.startsWith(assetRoot.pathname))throw Error('Coastal assets must remain local');return url;});
  const loader=new GLTFLoader(manager),textures=new THREE.TextureLoader(manager);let released=false;
  const release=()=>{if(released)return;released=true;const geometries=new Set(),materials=new Set(),images=new Set(extraTextures);for(const root of roots)parts(root).forEach(p=>{geometries.add(p.geometry);materials.add(p.material);if(p.customDepthMaterial)materials.add(p.customDepthMaterial);});for(const model of models){geometries.add(model.farGeometry);model.farMaterials.forEach(m=>materials.add(m));}for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)images.add(value);material.dispose();}geometries.forEach(g=>g.dispose());images.forEach(t=>t.dispose());};
  const check=()=>{if(signal?.aborted)throw new DOMException('准备已中断','AbortError');};
  try{
  check();const response=await fetch(new URL('woody-surface-voxels.json',assetRoot),{signal});if(!response.ok)throw Error('海岸占地资料加载失败');const data=await response.json();
  for(const name of ['island_tree_01','island_tree_02','island_tree_03']){
    const results=await Promise.allSettled(['near','mid'].map(level=>loader.loadAsync(new URL(`${name}/${name}_${level}.gltf`,assetRoot).href).then(result=>{roots.push(result.scene);return result;})));const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;check();const [near,mid]=results.map(r=>r.value),materials=parts(near.scene).map(p=>p.material);
    parts(mid.scene).forEach((p,i)=>{for(const value of Object.values(p.material))if(value?.isTexture)value.dispose();p.material.dispose();p.material=materials[i];});
    for(const root of [near.scene,mid.scene])parts(root).forEach(p=>{if(p.material.name.endsWith('_leaves')){p.material.alphaTest=0;p.material.alphaToCoverage=true;}p.castShadow=p.receiveShadow=true;p.customDepthMaterial=new THREE.MeshDepthMaterial({map:p.material.map,alphaTest:p.material.name.endsWith('_leaves')?.45:0,side:p.material.side,depthPacking:THREE.RGBADepthPacking});});
    const box=new THREE.Box3().setFromObject(near.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),farGeometry=new THREE.PlaneGeometry(Math.max(size.x,size.z)*1.05,size.y*1.05),farMaterials=[];farGeometry.translate(0,center.y,0);
    models.push({name,near:near.scene,mid:mid.scene,box,center,farGeometry,farMaterials,cells:data.models[name].occupiedCells,boxes:mergeFootprintCells(data.models[name].occupiedCells,data.cellSize),minY:data.models[name].minY});
    for(let frame=0;frame<4;frame++){const results=await Promise.allSettled(['color','normal'].map(k=>textures.loadAsync(new URL(`impostors-r3/${name}-${frame}-${k}.png`,assetRoot).href).then(texture=>{extraTextures.push(texture);return texture;})));const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;check();const [map,normalMap]=results.map(r=>r.value);map.colorSpace=THREE.SRGBColorSpace;farMaterials.push(new THREE.MeshStandardMaterial({map,normalMap,roughness:1,alphaToCoverage:true,side:THREE.DoubleSide}));}
  }check();return {models,unit:UNIT,release};
  }catch(error){release();throw error;}
}
export function bindCoastalVisual(view,prepared){
  const original=view.batches.filter(r=>r.entries[0]?.type==='tree'),chosen=view.world.objects.filter(o=>o.type==='tree'&&['coast','shoal'].includes(islandTreeAppearance(o).form)&&!o.id.startsWith('starter')&&Math.hypot(o.x-SPAWN.x,o.z-SPAWN.z)>18&&!LANDMARKS.some(l=>Math.hypot(o.x-l.x,o.z-l.z)<12)),ids=new Set(chosen.map(o=>o.id)),trees=[],kept=[],originalObstacles=view.cameraObstacles;let released=false;
  for(const record of original){const rows=record.entries.map((o,i)=>({o,i})).filter(({o})=>!ids.has(o.id));record.batch.visible=false;if(!rows.length)continue;
    const batch=new THREE.InstancedMesh(record.batch.geometry,record.batch.material,rows.length);batch.customDepthMaterial=record.batch.customDepthMaterial;batch.castShadow=batch.receiveShadow=true;
    rows.forEach(({i},j)=>{const m=new THREE.Matrix4();record.batch.getMatrixAt(i,m);batch.setMatrixAt(j,m);if(record.batch.instanceColor){const c=new THREE.Color();record.batch.getColorAt(i,c);batch.setColorAt(j,c);}});batch.computeBoundingSphere();view.scene.add(batch);const keptRecord={batch,entries:rows.map(r=>r.o),part:record.part.clone(),hidden:new Set()};view.batches.push(keptRecord);kept.push(keptRecord);
  }
  for(const [i,node]of chosen.entries()){
    const model=prepared.models[i%3],scale=node.scale*UNIT,frame={x:node.x,y:node.y-model.minY*scale,z:node.z,rotation:node.rotation,scale};registerFootprint(node,model.boxes,terrain,frame);
    const root=new THREE.Group();root.position.set(frame.x,frame.y,frame.z);root.rotation.y=frame.rotation;root.scale.setScalar(scale);
    const near=model.near.clone(true),mid=model.mid.clone(true),far=new THREE.Mesh(model.farGeometry,model.farMaterials[0]);far.position.set(model.center.x,0,model.center.z);
    for(const [key,clone]of [['near',near],['mid',mid]])parts(clone).forEach((p,j)=>p.customDepthMaterial=parts(model[key])[j].customDepthMaterial);
    root.add(near,mid,far);view.scene.add(root);trees.push({node,model,root,near,mid,far,frame,level:'hidden'});
  }
  view.cameraObstacles=[...view.cameraObstacles.filter(o=>!ids.has(o.object.id)),...trees.map(t=>({object:t.node,boxes:footprintBoxes(t.node).map(([min,max])=>new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max)))}))];
  return {trees,update(state){let n=0,m=0;for(const {t,d}of trees.map(t=>({t,d:Math.hypot(t.node.x-state.player.x,t.node.z-state.player.z)})).sort((a,b)=>a.d-b.d)){
    const depleted=isDepleted(state,t.node);let level='far';if(d<18&&n<2){level='near';n++;}else if(d<40&&m<6){level='mid';m++;}if(d>260||depleted)level='hidden';t.level=level;t.root.visible=level!=='hidden';for(const k of ['near','mid','far'])t[k].visible=k===level;
    const angle=Math.atan2(view.camera.position.x-t.node.x,view.camera.position.z-t.node.z)-t.node.rotation,frame=((Math.round(angle/(Math.PI/2))%4)+4)%4;t.far.rotation.y=frame*Math.PI/2;t.far.material=t.model.farMaterials[frame];
  }},release(){if(released)return;released=true;for(const tree of trees)view.scene.remove(tree.root);for(const record of kept){view.scene.remove(record.batch);record.batch.dispose();}view.batches=view.batches.filter(record=>!kept.includes(record));view.cameraObstacles=originalObstacles;original.forEach(record=>record.batch.visible=true);prepared.release();}};
}
