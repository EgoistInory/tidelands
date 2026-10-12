import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createCharacter,animateCharacter} from '../src/character.js';
import {buildingModel} from '../src/scene.js';

const root=path.resolve(import.meta.dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const baseline=read('docs/textile-baseline.json');
const priorCharacter=await import(pathToFileURL(path.join(baseline.baselinePath,'src/character.js')));
const priorScene=await import(pathToFileURL(path.join(baseline.baselinePath,'src/scene.js')));
const hash=data=>createHash('sha256').update(data).digest('hex');
function signature(group){
  group.updateMatrixWorld(true);const parts=[];
  group.traverse(mesh=>{if(mesh.isMesh){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    parts.push({vertices:hash(Buffer.from(p.array.buffer,p.array.byteOffset,p.array.byteLength)),normals:n?hash(Buffer.from(n.array.buffer,n.array.byteOffset,n.array.byteLength)):null,
      matrix:mesh.matrixWorld.toArray(),index:mesh.geometry.index?hash(Buffer.from(mesh.geometry.index.array.buffer)):null});}});return parts;
}
const models=[];
for(const color of [0xb86636,0x5f8176]){
  const a=createCharacter(color),b=priorCharacter.createCharacter(color);
  assert.deepEqual(signature(a),signature(b));let poses=0;
  for(const selected of ['hand','axe','sword'])for(const gatherKind of ['berry','stone','shell'])for(let i=0;i<=30;i++){
    const state={x:0,z:0,yaw:0,time:10+i/60,attackAt:-100,gatherAt:10,selected,gatherKind,gatherTool:gatherKind==='stone'?'axe':'hand'};
    animateCharacter(a,state,1/60,()=>0);priorCharacter.animateCharacter(b,state,1/60,()=>0);assert.deepEqual(signature(a),signature(b));poses++;
  }
  models.push({kind:'character',color,geometryAndPoseUnchanged:true,poses});
}
const a=buildingModel('tent'),b=priorScene.buildingModel('tent');assert.deepEqual(signature(a),signature(b));
models.push({kind:'tent',geometryAndPoseUnchanged:true,uvAdded:true});
const textures=new Set();a.traverse(m=>{if(m.isMesh&&m.material.userData.textile){textures.add(m.material.map);textures.add(m.material.bumpMap);}});
const report={passed:true,baselineArchive:baseline.baselineArchive,models,sharedTextureCount:textures.size,
  rawTextureBytes:[...textures].reduce((n,t)=>n+t.image.data.byteLength,0),fullGoalComplete:false,
  note:'Vertex/normal/index and world transforms match the extracted preceding package at declared poses. Local bytes are not measured GPU memory or runtime performance.',
  sourceSha256:Object.fromEntries(['src/textile.js','src/character.js','src/scene.js','tests/textile.test.js','tests/textile-review.html'].map(n=>[n,hash(fs.readFileSync(path.join(root,n)))]))};
fs.writeFileSync(path.join(root,'docs/textile-numerical.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,models,sharedTextureCount:report.sharedTextureCount,rawTextureBytes:report.rawTextureBytes}));
