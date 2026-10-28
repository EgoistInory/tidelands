// Read-only survey of the rendered R3 trunk base at the15 original inland resource positions.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createWorld,terrain} from '../src/world.js';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'dist/inland-authored-component-candidate/jacaranda_tree'),doc=JSON.parse(await fs.readFile(path.join(folder,'jacaranda_tree_near.gltf'))),binary=await fs.readFile(path.join(folder,'jacaranda_tree_near.bin')),audit=JSON.parse(await fs.readFile(path.join(root,'docs/inland-component-structure-audit.json'))),sha=b=>createHash('sha256').update(b).digest('hex');
if(sha(binary)!==audit.rows.find(r=>r.level==='near').sha256||doc.nodes.some(n=>n.matrix||n.translation||n.rotation||n.scale))throw Error('Changed or transformed candidate');
function read(index){const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],w={VEC3:3,SCALAR:1}[a.type];if(!w||a.sparse||a.normalized||v.byteStride||![5125,5126].includes(a.componentType))throw Error('Unsupported root accessor');const out=a.componentType===5126?new Float32Array(a.count*w):new Uint32Array(a.count*w),start=(v.byteOffset??0)+(a.byteOffset??0);for(let i=0;i<out.length;i++)out[i]=a.componentType===5126?binary.readFloatLE(start+i*4):binary.readUInt32LE(start+i*4);return out;}
const primitive=doc.meshes[0].primitives.find(p=>doc.materials[p.material].name.endsWith('_trunk')),positions=read(primitive.attributes.POSITION),indices=read(primitive.indices),step=.15,bottom=new Map();
const insert=(x,y,z)=>{if(y>1.2)return;const key=`${Math.floor(x/step)},${Math.floor(z/step)}`;if(!bottom.has(key)||bottom.get(key)[1]>y)bottom.set(key,[x,y,z]);};
for(let i=0;i<positions.length;i+=3)insert(...positions.subarray(i,i+3));
let probes=0;
for(let i=0;i<indices.length;i+=3){
 const p=[0,1,2].map(j=>Array.from(positions.subarray(indices[i+j]*3,indices[i+j]*3+3)));if(Math.min(...p.map(v=>v[1]))>1.2)continue;
 const [a,b,c]=p,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue;
 const minX=Math.floor(Math.min(...p.map(v=>v[0]))/step),maxX=Math.floor(Math.max(...p.map(v=>v[0]))/step),minZ=Math.floor(Math.min(...p.map(v=>v[2]))/step),maxZ=Math.floor(Math.max(...p.map(v=>v[2]))/step);
 for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
  if(++probes>2000000)throw Error('Root survey over budget');const xx=(x+.5)*step,zz=(z+.5)*step,u=((b[2]-c[2])*(xx-c[0])+(c[0]-b[0])*(zz-c[2]))/den,v=((c[2]-a[2])*(xx-c[0])+(a[0]-c[0])*(zz-c[2]))/den,w=1-u-v;
  if(Math.min(u,v,w)>=-1e-8)insert(xx,u*a[1]+v*b[1]+w*c[1],zz);
 }
}
const source=JSON.parse(await fs.readFile(path.join(root,'docs/inland-authored-topology.json'))).models.jacaranda_tree,baseOffset=-Math.min(...source.primitives.map(p=>p.bounds.min[1])),unit=2.95/1.8195863831788301,selected=JSON.parse(await fs.readFile(path.join(root,'docs/inland-component-world-near.json'))),world=createWorld(),before=JSON.stringify(world.objects),rows=[];
const summary=points=>{const gaps=points.map(p=>p.gap).sort((a,b)=>a-b),flat=points.map(p=>p.flatGap).sort((a,b)=>a-b);return {samples:points.length,minGap:gaps[0],p05Gap:gaps[Math.floor(gaps.length*.05)],medianGap:gaps[Math.floor(gaps.length*.5)],p95Gap:gaps[Math.floor(gaps.length*.95)],maxGap:gaps.at(-1),flatMinGap:flat[0],flatMaxGap:flat.at(-1),within15cm:points.filter(p=>Math.abs(p.gap)<=.15).length,above35cm:points.filter(p=>p.gap>.35).length,below35cm:points.filter(p=>p.gap<-.35).length,minimumPoint:points.reduce((a,b)=>a.gap<b.gap?a:b),maximumPoint:points.reduce((a,b)=>a.gap>b.gap?a:b)};};
for(const id of selected.selectedIds){
 const node=world.objects.find(o=>o.id===id),saved=selected.selectedOriginalPositions.find(o=>o[0]===id);if(!node||[node.x,node.y,node.z,node.scale].some((v,i)=>v!==saved[i+1]))throw Error('World resource moved');
 const scale=unit*node.scale,c=Math.cos(node.rotation),s=Math.sin(node.rotation),points=[...bottom.values()].map(([x,y,z])=>{const wx=node.x+scale*(c*x+s*z),wz=node.z+scale*(-s*x+c*z),wy=node.y+scale*(y+baseOffset);return {native:[x,y,z],world:[wx,wy,wz],ground:terrain(wx,wz),gap:wy-terrain(wx,wz),flatGap:scale*(y+baseOffset),terrainDelta:terrain(wx,wz)-node.y};});
 const basal=points.filter(p=>p.native[1]+baseOffset<=.3);if(!basal.length)throw Error('No measured basal support');rows.push({id,position:[node.x,node.y,node.z],scale:node.scale,rotation:node.rotation,basalBandNativeHeight:.3,basal:summary(basal),wholeLowerTrunk:summary(points)});
}
if(JSON.stringify(world.objects)!==before)throw Error('World changed during survey');
const report={verified:true,geometrySha256:sha(binary),nativeGridStep:step,rootHeightCutoff:1.2,nativeRootSamples:bottom.size,probes,unit,baseOffset,originalWorldObjectsUnchanged:true,rows,wholeSampledBasalBandAbove35cm:rows.filter(r=>r.basal.minGap>.35).map(r=>r.id),interpretation:'Lowest raster/vertex samples per localXZ cell at actual render transform. Positive gap means above terrain. Basal band and flat-ground control retained; root arches are not automatically a floating-tree bug. Survey only, no geometry or ordinary save changes.',productionIntegrated:false,rootSupportAccepted:false,lowWoodContactAccepted:false};
await fs.writeFile(path.join(root,'docs/inland-root-support-survey.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({verified:true,resources:rows.length,nativeRootSamples:bottom.size,probes,wholeSampledBasalBandAbove35cm:report.wholeSampledBasalBandAbove35cm,nearRootFixture:rows.find(r=>r.id==='resource-1765')}));
