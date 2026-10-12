import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';
const root=path.resolve(import.meta.dirname,'..'),baseline=JSON.parse(fs.readFileSync(path.join(root,'docs/tidelands-m5-2026-10-12-buildlimit-verification.json')));
const prior=await import(pathToFileURL(path.join(baseline.extractedPath,'src/character.js')));
const hash=data=>createHash('sha256').update(data).digest('hex');
const oldHash=hash(fs.readFileSync(path.join(baseline.extractedPath,'src/character.js')));
assert.equal(oldHash,'ba4ec4953469ab564dfc7d1d9234684afe83df31834b3c7b4a2e7c94a4087228');
function visible(group){group.updateMatrixWorld(true);const bounds=new THREE.Box3(),geometries=new Set();let meshes=0,triangles=0,bytes=0;
  group.traverseVisible(m=>{if(!m.isMesh)return;meshes++;m.geometry.computeBoundingBox();bounds.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));geometries.add(m.geometry);});
  for(const g of geometries){triangles+=(g.index?.count??g.attributes.position.count)/3;bytes+=(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0);}
  return {meshes,triangles,uniqueGeometries:geometries.size,geometryArrayBytes:bytes,height:bounds.getSize(new THREE.Vector3()).y,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
}
function signature(group){group.updateMatrixWorld(true);const parts=[];group.traverse(m=>{if(m.isMesh)parts.push({matrix:m.matrixWorld.toArray(),positions:hash(Buffer.from(m.geometry.attributes.position.array.buffer)),normals:hash(Buffer.from(m.geometry.attributes.normal.array.buffer)),indices:m.geometry.index&&hash(Buffer.from(m.geometry.index.array.buffer))});});return parts;}
const models=[];
for(const color of [0xb86636,0x5f8176]){
  const a=createCharacter(color),b=prior.createCharacter(color);let poses=0;
  for(const selected of ['hand','axe','sword'])for(const gatherKind of ['berry','stone','shell'])for(let i=0;i<=30;i++){
    const s={x:0,z:0,yaw:0,time:10+i/60,attackAt:-100,gatherAt:10,selected,gatherKind,gatherTool:gatherKind==='stone'?'axe':'hand'};
    animateCharacter(a,s,1/60,()=>0);prior.animateCharacter(b,s,1/60,()=>0);a.updateMatrixWorld(true);b.updateMatrixWorld(true);
    for(const key of ['hips','knees','ankles','shoulders','elbows'])for(let j=0;j<2;j++)assert.deepEqual(a.userData[key][j].matrixWorld.toArray(),b.userData[key][j].matrixWorld.toArray(),key);
    for(const key of ['axe','sword'])assert.deepEqual(signature(a.userData[key]),signature(b.userData[key]),key);
    for(let j=0;j<2;j++)assert.deepEqual(signature(a.userData.ankles[j]),signature(b.userData.ankles[j]),'boots');poses++;
  }
  models.push({color,poses,boneToolBootTransformsAndGeometryUnchanged:true});
}
const a=createCharacter(),b=prior.createCharacter();for(const c of [a,b]){const animate=c===a?animateCharacter:prior.animateCharacter;animate(c,{x:0,z:0,yaw:0,time:10,attackAt:-100,selected:'hand'},0,()=>0);}
const face=a.getObjectByName('traveler-head-surface');face.geometry.computeBoundingBox();const headHeight=face.geometry.boundingBox.getSize(new THREE.Vector3()).y;
const after=visible(a),before=visible(b);
const report={kind:'production-adult-character-numerical-review',passed:true,baselineArchive:baseline.archive,baselineArchiveSha256:baseline.archiveSha256,baselineCharacterSha256:oldHash,models,before,after,headHeight,headHeightsPerVisibleHeight:after.height/headHeight,fullGoalComplete:false,limits:['Bone/tool/boot equality at 279 declared gathering poses per color does not prove all moving contacts or visual naturalness.','Head/body geometry changes intentionally; CPU array counts are not GPU memory or device performance.']};
const textures=new Set();a.traverse(m=>{if(m.isMesh)for(const t of [m.material.map,m.material.bumpMap])if(t)textures.add(t);});report.sharedTextureCount=textures.size;
report.sourceSha256=Object.fromEntries(['src/character.js','src/character-head.js','tests/character-art.test.js'].map(n=>[n,hash(fs.readFileSync(path.join(root,n)))]));
fs.writeFileSync(path.join(root,'docs/character-adult-numerical.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
