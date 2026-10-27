// Offline workload inventory for the existing isolated contact candidate.
// Counts source primitives, not GPU time, frustum visibility or shadow passes.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createWorld,SPAWN,LANDMARKS} from '../src/world.js';
import {islandTreeAppearance} from '../src/landscape.js';
const root=new URL('../',import.meta.url),names=['island_tree_01','island_tree_02','island_tree_03'];
const read=async path=>JSON.parse(await fs.readFile(new URL(path,root),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const baseline=await read('dist/tidelands-m5-2026-10-27-cast-clothing.json');
for(const [name,row] of Object.entries(baseline.files))assert.equal(sha(await fs.readFile(new URL(name==='README.md'?'docs/LOCAL-DELIVERY.md':name,root))),row.sha256);
const models=[];
for(const name of names){
  const levels={};
  for(const level of ['near','mid']){
    const path=`dist/canopy-authored-candidate/${name}/${name}_${level}.gltf`,bytes=await fs.readFile(new URL(path,root)),gltf=JSON.parse(bytes),meshes=[];
    const visit=index=>{const node=gltf.nodes[index];if(node.mesh!==undefined)meshes.push(gltf.meshes[node.mesh]);for(const child of node.children??[])visit(child);};
    for(const index of gltf.scenes[gltf.scene??0].nodes)visit(index);
    let triangles=0,primitives=0;
    for(const mesh of meshes)for(const p of mesh.primitives){assert.equal(p.mode??4,4);const count=gltf.accessors[p.indices??p.attributes.POSITION].count;assert.equal(count%3,0);triangles+=count/3;primitives++;}
    levels[level]={primitives,triangles,gltfSha256:sha(bytes),geometryBufferBytes:gltf.buffers.reduce((s,b)=>s+b.byteLength,0)};
  }
  levels.far={primitives:1,triangles:2};models.push({name,...levels});
}
const world=createWorld(),originalWorld=JSON.stringify(world),nodes=world.objects.filter(o=>o.type==='tree'&&['coast','shoal'].includes(islandTreeAppearance(o).form)&&!o.id.startsWith('starter')&&Math.hypot(o.x-SPAWN.x,o.z-SPAWN.z)>18&&!LANDMARKS.some(l=>Math.hypot(o.x-l.x,o.z-l.z)<12));
assert.equal(nodes.length,133);
const points=[{id:'spawn',...SPAWN},...nodes.map(n=>({id:n.id,x:n.x,z:n.z}))],samples=[];
for(const point of points)for(let heading=0;heading<8;heading++){
  // Camera offset samples view direction cohorts only. No projected/frustum test.
  const a=heading*Math.PI/4,camera={x:point.x+Math.sin(a)*8,z:point.z+Math.cos(a)*8},counts={near:0,mid:0,far:0,hidden:0},groups=new Map();let calls=0,triangles=0,heavyTriangles=0;
  const ranked=nodes.map((node,i)=>({node,i,d:Math.hypot(node.x-point.x,node.z-point.z)})).sort((a,b)=>a.d-b.d);
  for(const {node,i,d}of ranked){
    let level='far';if(d<18&&counts.near<2)level='near';else if(d<40&&counts.mid<6)level='mid';if(d>260)level='hidden';counts[level]++;if(level==='hidden')continue;
    const model=models[i%3],shape=model[level],angle=Math.atan2(camera.x-node.x,camera.z-node.z)-node.rotation,frame=((Math.round(angle/(Math.PI/2))%4)+4)%4;
    const key=`${model.name}/${level}/${level==='far'?frame:'shared'}`;
    groups.set(key,shape.primitives);calls+=shape.primitives;triangles+=shape.triangles;if(level!=='far')heavyTriangles+=shape.triangles;
  }
  const proposedInstancedCalls=[...groups.values()].reduce((s,n)=>s+n,0);
  assert(counts.near<=2&&counts.mid<=6&&proposedInstancedCalls<=30&&proposedInstancedCalls<=calls);
  samples.push({point:point.id,heading,counts,unbatchedCalls:calls,proposedInstancedCalls,triangles,heavyTriangles});
}
assert.equal(JSON.stringify(world),originalWorld);
const max=key=>samples.reduce((a,b)=>b[key]>a[key]?b:a),report={scope:'Offline source-primitive workload upper envelope before frustum/shadow passes; proposed grouping is not integrated or rendered.',nodes:nodes.length,models,samples:samples.length,maxUnbatchedCalls:max('unbatchedCalls'),maxProposedInstancedCalls:max('proposedInstancedCalls'),maxTriangles:max('triangles'),maxHeavyTriangles:max('heavyTriangles'),productionRuntimeInputsUnchanged:Object.keys(baseline.files).length,worldUnchanged:true,instancingImplemented:false,nativeMovingLodAccepted:false,currentGpuOrEnduranceAccepted:false,milestoneM5Complete:false,fullGoalComplete:false};
await fs.writeFile(new URL('docs/coastal-representation-budget.json',root),JSON.stringify(report,null,2)+'\n');
await fs.mkdir(new URL('dist/coastal-representation-budget/',root),{recursive:true});
await fs.writeFile(new URL('dist/coastal-representation-budget/samples.json',root),JSON.stringify(samples,null,2)+'\n');
console.log(JSON.stringify(report));
