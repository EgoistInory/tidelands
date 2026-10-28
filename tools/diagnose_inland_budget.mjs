// Offline differential diagnosis; never rewrite source or candidate geometry.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {deduplicateSurface} from './exact-surface-dedup.mjs';
const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'dist/inland-authored-source/jacaranda_tree'),sha=b=>createHash('sha256').update(b).digest('hex');
const acquired=JSON.parse(await fs.readFile(path.join(dir,'acquisition.json'))),meta=await fs.readFile(path.join(dir,'jacaranda_tree_1k.gltf'));if(sha(meta)!==acquired.files['jacaranda_tree_1k.gltf'].sha256)throw Error('Changed metadata');
const doc=JSON.parse(meta),buffer=await fs.readFile(path.join(dir,doc.buffers[0].uri));if(sha(buffer)!==acquired.files[doc.buffers[0].uri].sha256)throw Error('Changed source');
const tool=path.join(root,'tools/vendor/meshoptimizer-0.24/meshopt_simplifier.mjs');if(sha(await fs.readFile(tool))!=='68f7b94830e3be31b7f08eb09c01b5c3867c74437d27807629541b3874bab567')throw Error('Changed simplifier');
const {MeshoptSimplifier:M}=await import(pathToFileURL(tool));await M.ready;
function read(index){const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],w={SCALAR:1,VEC2:2,VEC3:3}[a.type];if(!w||![5126,5125].includes(a.componentType)||a.sparse||a.normalized)throw Error('Unsupported diagnostic accessor');const values=a.componentType===5126?new Float32Array(a.count*w):new Uint32Array(a.count*w);for(let i=0;i<a.count;i++)for(let j=0;j<w;j++){const offset=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??w*4)+j*4;values[i*w+j]=a.componentType===5126?buffer.readFloatLE(offset):buffer.readUInt32LE(offset);}return values;}
const rows=[];
for(const p of doc.meshes[0].primitives.slice(0,2)){
 const positions=read(p.attributes.POSITION),normals=read(p.attributes.NORMAL),uv=read(p.attributes.TEXCOORD_0),indices=read(p.indices),attrs=new Float32Array(positions.length/3*5);for(let i=0;i<positions.length/3;i++){attrs.set(normals.subarray(i*3,i*3+3),i*5);attrs.set(uv.subarray(i*2,i*2+2),i*5+3);}
 const outputs=[];for(const [mode,weights]of [['geometry-only',null],['original-attribute-weights',[.2,.2,.2,.1,.1]],['zero-attribute-weights',[0,0,0,0,0]]]){
  const target=Math.floor(indices.length*.15/3)*3,[result,error]=weights?M.simplifyWithAttributes(indices,positions,3,attrs,5,weights,null,target,.004,[]):M.simplify(indices,positions,3,target,.004,[]);
  outputs.push({mode,triangles:result.length/3,error});
 }
 let degenerate=0;for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,u=[0,1,2].map(j=>positions[b+j]-positions[a+j]),v=[0,1,2].map(j=>positions[c+j]-positions[a+j]);if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-12)degenerate++;}
 let topology=null;
 if(doc.materials[p.material].name.endsWith('_trunk')){
  const coordinates=new Map(),fullVertices=new Map(),welded=[],full=[],edges=new Map(),faces=new Set(),fullFaces=new Set();let duplicateFaces=0,duplicateAttributeFaces=0;
  for(let i=0;i<positions.length/3;i++){
   const key=Array.from(positions.subarray(i*3,i*3+3)).join(',');if(!coordinates.has(key))coordinates.set(key,coordinates.size);welded.push(coordinates.get(key));
   const all=key+','+Array.from(attrs.subarray(i*5,i*5+5)).join(',');if(!fullVertices.has(all))fullVertices.set(all,fullVertices.size);full.push(fullVertices.get(all));
  }
  for(let i=0;i<indices.length;i+=3){const ids=[0,1,2].map(j=>welded[indices[i+j]]),key=[...ids].sort((a,b)=>a-b).join(',');if(faces.has(key))duplicateFaces++;faces.add(key);
   const all=[0,1,2].map(j=>full[indices[i+j]]).sort((a,b)=>a-b).join(',');if(fullFaces.has(all))duplicateAttributeFaces++;fullFaces.add(all);
   for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],edge=a<b?a+','+b:b+','+a;edges.set(edge,(edges.get(edge)??0)+1);}
  }
  const owners={one:0,two:0,overTwo:0};for(const n of edges.values())owners[n===1?'one':n===2?'two':'overTwo']++;
  topology={sourceVertices:positions.length/3,exactPositionVertices:coordinates.size,exactAttributeVertices:fullVertices.size,duplicatePositionFaces:duplicateFaces,duplicateAttributeFaces,exactPositionEdgeOwners:owners};
 }
 let exactDeduplication=null;
 if(topology){
  const clean=deduplicateSurface({POSITION:positions,NORMAL:normals,TEXCOORD_0:uv},indices),n=clean.attributes.POSITION.length/3,attributes=new Float32Array(n*5);
  for(let i=0;i<n;i++){attributes.set(clean.attributes.NORMAL.subarray(i*3,i*3+3),i*5);attributes.set(clean.attributes.TEXCOORD_0.subarray(i*2,i*2+2),i*5+3);}
  const target=Math.floor(clean.indices.length*.15/3)*3,[reduced,error]=M.simplifyWithAttributes(clean.indices,clean.attributes.POSITION,3,attributes,5,[.2,.2,.2,.1,.1],null,target,.004,[]);
  exactDeduplication={removedSameWindingFaces:clean.removedFaces,removedIdenticalAttributeVertices:clean.removedVertices,cleanTriangles:clean.indices.length/3,simplifiedTriangles:reduced.length/3,error};
 }
 rows.push({material:doc.materials[p.material].name,sourceTriangles:indices.length/3,degenerateTriangles:degenerate,topology,exactDeduplication,outputs});
}
const report={verifiedSource:true,pruneUsed:false,sourceModified:false,candidateModified:false,productionIntegrated:false,rows};await fs.writeFile(path.join(root,'docs/inland-wood-budget-diagnosis.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
