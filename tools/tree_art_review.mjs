import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createWorld} from '../src/world.js';
import {createTree} from '../src/tree.js';
import {createBerryFoliage,barkSurface} from '../src/foliage.js';
import {mergeStaticParts} from '../src/merge-parts.js';
const root=path.resolve(new URL('..',import.meta.url).pathname),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const archive=JSON.parse(fs.readFileSync(path.join(root,'dist/tidelands-m5-2026-10-12-character.json'))),oldPath=JSON.parse(fs.readFileSync(path.join(root,'docs/tidelands-m5-2026-10-12-character-verification.json'))).extractedPath;
for(const [file,entry]of Object.entries(archive.files))if(hash(path.join(oldPath,file))!==entry.sha256)throw new Error('Frozen runtime input mismatch: '+file);
const oldScene=await import(pathToFileURL(path.join(oldPath,'src/scene.js'))),oldFoliage=await import(pathToFileURL(path.join(oldPath,'src/foliage.js'))),oldWorld=await import(pathToFileURL(path.join(oldPath,'src/world.js')));
function scenery(View,world){const view={world,scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};View.prototype.createScenery.call(view);return view;}
const before=scenery(oldScene.WorldView,oldWorld.createWorld()),after=scenery(WorldView,createWorld());
if(JSON.stringify(before.world.objects)!==JSON.stringify(after.world.objects))throw new Error('Resource nodes changed');
const treeBatches=view=>view.batches.filter(b=>b.entries[0]?.type==='tree');
function budget(view){return treeBatches(view).map(({batch,entries})=>({kind:batch.material.alphaTest>0?'leaves':'wood',instances:entries.length,triangles:(batch.geometry.index?.count??batch.geometry.attributes.position.count)/3,geometryArrayBytes:Object.values(batch.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(batch.geometry.index?.array.byteLength??0)}));}
for(const [i,a]of treeBatches(before).entries()){
 const b=treeBatches(after).find(b=>(b.batch.material.alphaTest>0)===(a.batch.material.alphaTest>0));
 if(!b||JSON.stringify(a.entries)!==JSON.stringify(b.entries)||JSON.stringify([...a.batch.instanceMatrix.array])!==JSON.stringify([...b.batch.instanceMatrix.array]))throw new Error('Tree instance transforms changed '+i);
}
const berry=createBerryFoliage(),oldBerry=oldFoliage.createBerryFoliage();
for(const name of ['position','normal','uv','color'])if(JSON.stringify([...berry.geometry.attributes[name].array])!==JSON.stringify([...oldBerry.geometry.attributes[name].array]))throw new Error('Berry geometry changed');
for(const [current,previous]of [[barkSurface().map,oldFoliage.barkSurface().map],[berry.material.map,oldBerry.material.map]])if(Buffer.compare(Buffer.from(current.image.data),Buffer.from(previous.image.data))!==0)throw new Error('Shared texture changed');
const model=createTree();model.updateMatrixWorld(true);mergeStaticParts(model);const bounds=new THREE.Box3().setFromObject(model);
const report={kind:'bounded-tree-art-numerical-review',passed:true,baselineArchive:archive.archive,baselineArchiveSha256:archive.archiveSha256,resourceNodesAndTreeInstanceTransformsUnchanged:true,berryGeometryAndSharedTexturesUnchanged:true,before:budget(before),after:budget(after),modelBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},fullGoalComplete:false,limits:['CPU arrays and static triangle/instance counts are not GPU memory or performance.','Same resource transforms do not prove all camera paths, gathering contacts, slopes or natural appearance.'],sourceSha256:Object.fromEntries(['src/tree.js','src/foliage.js','src/scene.js','tests/tree.test.js'].map(p=>[p,hash(path.join(root,p))]))};
fs.writeFileSync(path.join(root,'docs/tree-art-numerical.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
