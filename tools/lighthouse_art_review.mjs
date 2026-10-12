import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createWorld} from '../src/world.js';
import {cottageSurfaces} from '../src/cottage-surfaces.js';
const root=path.resolve(new URL('..',import.meta.url).pathname),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const archive=JSON.parse(fs.readFileSync(path.join(root,'dist/tidelands-m5-2026-10-12-trees.json'))),oldPath=JSON.parse(fs.readFileSync(path.join(root,'docs/tidelands-m5-2026-10-12-trees-verification.json'))).extractedPath;
for(const [file,entry]of Object.entries(archive.files))if(hash(path.join(oldPath,file))!==entry.sha256)throw new Error('Frozen runtime input mismatch: '+file);
const oldScene=await import(pathToFileURL(path.join(oldPath,'src/scene.js'))),oldWorld=await import(pathToFileURL(path.join(oldPath,'src/world.js')));
function scenery(View,world){const view={world,scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};View.prototype.createScenery.call(view);return view;}
const before=scenery(oldScene.WorldView,oldWorld.createWorld()),after=scenery(WorldView,createWorld());
if(JSON.stringify(before.world)!==JSON.stringify(after.world))throw new Error('World data changed');
if(before.batches.length!==after.batches.length)throw new Error('World batch count changed');
for(const [i,a]of before.batches.entries()){
  const b=after.batches[i];
  if(JSON.stringify(a.entries)!==JSON.stringify(b.entries)||Buffer.compare(Buffer.from(a.batch.instanceMatrix.array.buffer),Buffer.from(b.batch.instanceMatrix.array.buffer)))throw new Error('Resource transforms changed '+i);
  for(const name of Object.keys(a.batch.geometry.attributes))if(JSON.stringify([...a.batch.geometry.attributes[name].array])!==JSON.stringify([...b.batch.geometry.attributes[name].array]))throw new Error('Resource geometry changed '+i+'/'+name);
  if(JSON.stringify(a.batch.geometry.index?[...a.batch.geometry.index.array]:null)!==JSON.stringify(b.batch.geometry.index?[...b.batch.geometry.index.array]:null))throw new Error('Resource indices changed '+i);
}
function beaconState(group){const b=group.userData.beacon,beam=b.children.find(m=>m.isMesh),light=b.children.find(m=>m.isPointLight);return {y:b.position.y,visible:b.visible,beamPosition:beam.position.toArray(),beamRotation:beam.rotation.toArray(),geometry:beam.geometry.parameters,material:{color:beam.material.color.getHex(),opacity:beam.material.opacity,depthWrite:beam.material.depthWrite,side:beam.material.side},light:{color:light.color.getHex(),intensity:light.intensity,distance:light.distance,decay:light.decay}};}
if(JSON.stringify(beaconState(before.lighthouse))!==JSON.stringify(beaconState(after.lighthouse)))throw new Error('Beacon semantics changed');
for(const prefix of ['    if(this.lighthouse){','    for(const o of LANDMARKS)if([']){
  const line=p=>fs.readFileSync(p,'utf8').split('\n').find(s=>s.startsWith(prefix));
  if(line(path.join(root,'src/scene.js'))!==line(path.join(oldPath,'src/scene.js')))throw new Error('Emission update or camera envelope changed');
}
function budget(group){let meshes=0,triangles=0,geometryArrayBytes=0;const box=new THREE.Box3(),maps=new Set();group.updateMatrixWorld(true);group.traverse(m=>{
  if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
  geometryArrayBytes+=Object.values(m.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(m.geometry.index?.array.byteLength??0);
  if(m.material.map)maps.add(m.material.map);
  let beam=false;for(let p=m.parent;p;p=p.parent)if(p===group.userData.beacon)beam=true;
  if(!beam)box.union(new THREE.Box3().setFromObject(m));
});return {meshes,triangles,geometryArrayBytes,mapCount:maps.size,staticBounds:{min:box.min.toArray(),max:box.max.toArray()}};}
const shared=new Set(Object.values(cottageSurfaces()).filter(v=>v?.map).map(v=>v.map));
after.lighthouse.traverse(m=>{if(m.material?.map&&!shared.has(m.material.map))throw new Error('Unexpected new lighthouse texture');});
const report={kind:'bounded-lighthouse-art-numerical-review',passed:true,baselineArchive:archive.archive,baselineArchiveSha256:archive.archiveSha256,baselineRuntimeInputsVerified:44,worldAndResourceGeometryTransformsUnchanged:true,beaconParametersAndUpdateUnchanged:true,cameraEnvelopeUnchanged:true,cottageMapsReused:true,before:budget(before.lighthouse),after:budget(after.lighthouse),beacon:beaconState(after.lighthouse),fullGoalComplete:false,limits:['Geometry arrays are CPU bytes, not GPU memory or timing.','Cottage maps are reused but become resident here: browser textures increased from 16 to 19.','Static bounds and unchanged updates do not prove natural contacts, complete main-line quality or all camera paths.'],sourceSha256:Object.fromEntries(['src/lighthouse.js','src/scene.js','tests/lighthouse.test.js'].map(p=>[p,hash(path.join(root,p))]))};
fs.writeFileSync(path.join(root,'docs/lighthouse-art-numerical.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
