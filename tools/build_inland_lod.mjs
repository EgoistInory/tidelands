// Offline only: preserve every leaf component as an alpha-masked fitted patch.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {fitLeafPatch} from './leaf-patch-lod.mjs';
import {deduplicateSurface,surfaceFingerprint} from './exact-surface-dedup.mjs';
import {simplifyLeafComponent} from './leaf-component-decimation.mjs';
const componentMesh=process.argv.includes('--component-mesh'),exactDedup=process.argv.includes('--exact-dedup')||componentMesh;
const root=path.resolve(import.meta.dirname,'..'),source=path.join(root,'dist/inland-authored-source'),output=path.join(root,componentMesh?'dist/inland-authored-component-candidate':exactDedup?'dist/inland-authored-dedup-candidate':'dist/inland-authored-candidate');
const tool=path.join(root,'tools/vendor/meshoptimizer-0.24/meshopt_simplifier.mjs'),sha=b=>createHash('sha256').update(b).digest('hex'),expected='68f7b94830e3be31b7f08eb09c01b5c3867c74437d27807629541b3874bab567';
if(sha(await fs.readFile(tool))!==expected)throw Error('Pinned simplifier mismatch');
const {MeshoptSimplifier:M}=await import(pathToFileURL(tool));await M.ready;
const widths={SCALAR:1,VEC2:2,VEC3:3},report={source:'Poly Haven CC0, all source checksums verified',tool:{version:'meshoptimizer v0.24',sha256:expected,pruneUsed:false},models:{},productionIntegrated:false,visualAccepted:false};
for(const name of ['jacaranda_tree']){
  const dir=path.join(source,name),doc=JSON.parse(await fs.readFile(path.join(dir,name+'_1k.gltf'),'utf8')),manifest=JSON.parse(await fs.readFile(path.join(dir,'acquisition.json'),'utf8'));
  if(sha(await fs.readFile(path.join(dir,name+'_1k.gltf')))!==manifest.files[name+'_1k.gltf'].sha256)throw Error('Original glTF changed');
  const buffer=await fs.readFile(path.join(dir,doc.buffers[0].uri));if(sha(buffer)!==manifest.files[doc.buffers[0].uri].sha256)throw Error('Original geometry changed');
  const read=index=>{const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],w=widths[a.type],size={5123:2,5125:4,5126:4}[a.componentType],result=a.componentType===5126?new Float32Array(a.count*w):new Uint32Array(a.count*w);if(!w||!size||a.sparse||a.normalized)throw Error('Unsupported accessor');for(let i=0;i<a.count;i++)for(let j=0;j<w;j++){const offset=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??w*size)+j*size;if(offset+size>buffer.length)throw Error('Accessor outside source');result[i*w+j]=a.componentType===5126?buffer.readFloatLE(offset):size===2?buffer.readUInt16LE(offset):buffer.readUInt32LE(offset);}return result;};
  // COLOR_0 is provably neutral; COLOR_1 is unused by the stock glTF material.
  for(const p of doc.meshes[0].primitives){
    const a=doc.accessors[p.attributes.COLOR_0],v=doc.bufferViews[a.bufferView];
    if(a.type!=='VEC4'||a.componentType!==5121||!a.normalized)throw Error('Unexpected source color format');
    for(let i=0;i<a.count;i++)for(let j=0;j<4;j++)if(buffer[(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??4)+j]!==255)throw Error('Non-neutral source colors must be preserved');
  }
  const primitiveData=doc.meshes[0].primitives.map(p=>({source:p,attributes:Object.fromEntries(['POSITION','NORMAL','TEXCOORD_0'].map(k=>[k,read(p.attributes[k])])),indices:new Uint32Array(read(p.indices))}));
  const leaves=primitiveData.find(p=>doc.materials[p.source.material].name.endsWith('_leaves')),parent=Uint32Array.from({length:leaves.attributes.POSITION.length/3},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<leaves.indices.length;i+=3){const a=find(leaves.indices[i]);parent[find(leaves.indices[i+1])]=a;parent[find(leaves.indices[i+2])]=a;}
  const components=new Map();for(let i=0;i<parent.length;i++){const r=find(i);if(!components.has(r))components.set(r,[]);components.get(r).push(i);}
  const componentIndices=new Map();for(let i=0;i<leaves.indices.length;i++){const r=find(leaves.indices[i]);if(!componentIndices.has(r))componentIndices.set(r,[]);componentIndices.get(r).push(leaves.indices[i]);}
  if(process.argv.includes('--inspect-leaf-duplicates')){
    const seen=new Map(),examples=[];let duplicateComponents=0,duplicateTriangles=0;
    for(const [key,ids]of components){
      const remap=new Map(ids.map((id,i)=>[id,i])),attributes={};for(const [semantic,width]of [['POSITION',3],['NORMAL',3],['TEXCOORD_0',2]])attributes[semantic]=new Float32Array(ids.flatMap(i=>Array.from(leaves.attributes[semantic].subarray(i*width,i*width+width))));
      const indices=new Uint32Array(componentIndices.get(key).map(i=>remap.get(i))),fingerprint=surfaceFingerprint(attributes,indices);
      if(seen.has(fingerprint)){duplicateComponents++;duplicateTriangles+=indices.length/3;if(examples.length<10)examples.push({firstRoot:seen.get(fingerprint),duplicateRoot:key,fingerprint});}else seen.set(fingerprint,key);
    }
    const result={sourceVerified:true,sourceLeafComponents:components.size,uniqueExactComponents:seen.size,duplicateComponents,duplicateTriangles,comparison:'Complete component faces: exact position, normal and UV; cyclic winding preserved; triangle and vertex numbering ignored',pruneUsed:false,sourceOrCandidateModified:false,examples};
    await fs.writeFile(path.join(root,'docs/inland-leaf-duplicate-diagnosis.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exit(0);
  }
  report.models[name]={sourceLeafComponents:components.size,neutralColor0Verified:true,color1UsedByStockMaterial:false,levels:{}};
  for(const level of ['near','mid']){
    const chunks=[],views=[],accessors=[],summaries=[];let byteLength=0;
    const append=(array,type,componentType)=>{const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),offset=byteLength;chunks.push(data);byteLength+=data.length;const view=views.push({buffer:0,byteOffset:offset,byteLength:data.length})-1,a={bufferView:view,componentType,count:array.length/widths[type],type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++){a.min[i%3]=Math.min(a.min[i%3],array[i]);a.max[i%3]=Math.max(a.max[i%3],array[i]);}}return accessors.push(a)-1;};
    const primitives=primitiveData.map(data=>{
      let attrs=data.attributes,indices=data.indices,error=0,maxLeafFitError=0,fallbackLeaves=0,retainedLeafComponents=0,removedExactDuplicateFaces=0,maxSourceSampleError=0,sourceSamples=0,maxComponentSimplifierError=0;const fallbackReasons={};
      const material=doc.materials[data.source.material].name;
      if(data===leaves){
        const positions=[],normals=[],uvs=[],triangles=[];
        for(const [key,ids]of components){
          const p=ids.flatMap(i=>Array.from(attrs.POSITION.subarray(i*3,i*3+3))),uv=ids.flatMap(i=>Array.from(attrs.TEXCOORD_0.subarray(i*2,i*2+2)));let patch;
          if(componentMesh){
            const remap=new Map(ids.map((id,i)=>[id,i])),original={POSITION:new Float32Array(p),NORMAL:new Float32Array(ids.flatMap(i=>Array.from(attrs.NORMAL.subarray(i*3,i*3+3)))),TEXCOORD_0:new Float32Array(uv)},sourceIndices=new Uint32Array(componentIndices.get(key).map(i=>remap.get(i))),reduced=simplifyLeafComponent(M,original,sourceIndices,level);
            patch={positions:reduced.attributes.POSITION,normals:reduced.attributes.NORMAL,uvs:reduced.attributes.TEXCOORD_0,indices:reduced.indices,maxSourceError:0};
            if(reduced.fallbackReason){fallbackLeaves++;fallbackReasons[reduced.fallbackReason]=(fallbackReasons[reduced.fallbackReason]??0)+1;}
            maxSourceSampleError=Math.max(maxSourceSampleError,reduced.maxSourceSampleError);sourceSamples+=reduced.sourceSamples;maxComponentSimplifierError=Math.max(maxComponentSimplifierError,reduced.simplifierError);
          }else try{patch=fitLeafPatch(p,uv,level==='near'?2:1);if(patch.maxSourceError>.009)throw Error('Leaf fit outside bound');}catch{
            const remap=new Map(ids.map((id,i)=>[id,i]));patch={positions:p,uvs:uv,normals:ids.flatMap(i=>Array.from(attrs.NORMAL.subarray(i*3,i*3+3))),indices:componentIndices.get(key).map(i=>remap.get(i)),maxSourceError:0};fallbackLeaves++;
          }
          const offset=positions.length/3;positions.push(...patch.positions);normals.push(...patch.normals);uvs.push(...patch.uvs);triangles.push(...patch.indices.map(i=>i+offset));maxLeafFitError=Math.max(maxLeafFitError,patch.maxSourceError);retainedLeafComponents++;
        }
        attrs={POSITION:new Float32Array(positions),NORMAL:new Float32Array(normals),TEXCOORD_0:new Float32Array(uvs)};indices=new Uint32Array(triangles);
      }else{
        if(exactDedup&&material.endsWith('_trunk')){const clean=deduplicateSurface(attrs,indices);attrs=clean.attributes;indices=clean.indices;removedExactDuplicateFaces=clean.removedFaces;}
        const count=attrs.POSITION.length/3,weights=new Float32Array(count*5);for(let i=0;i<count;i++){weights.set(attrs.NORMAL.subarray(i*3,i*3+3),i*5);weights.set(attrs.TEXCOORD_0.subarray(i*2,i*2+2),i*5+3);}
        const target=Math.floor(indices.length*(level==='near'?.15:.06)/3)*3;
        [indices,error]=M.simplifyWithAttributes(indices,attrs.POSITION,3,weights,5,[.2,.2,.2,.1,.1],null,target,level==='near'?.004:.012,[]);
        const [remap,countOut]=M.compactMesh(indices),compacted={};for(const [key,array]of Object.entries(attrs)){const w=key==='TEXCOORD_0'?2:3,result=new Float32Array(countOut*w);for(let i=0;i<remap.length;i++)if(remap[i]<countOut)result.set(array.subarray(i*w,i*w+w),remap[i]*w);compacted[key]=result;}attrs=compacted;
      }
      summaries.push({material,inputTriangles:data.indices.length/3,outputTriangles:indices.length/3,relativeSimplificationError:error,retainedLeafComponents,maxLeafFitError,fallbackLeaves,...(exactDedup?{removedExactDuplicateFaces}:{}),...(componentMesh&&data===leaves?{leafReduction:'source-component-mesh',maxSourceSampleError,sourceSamples,maxComponentSimplifierError,fallbackReasons}:{})});
      return {attributes:Object.fromEntries(Object.entries(attrs).map(([key,array])=>[key,append(array,key==='TEXCOORD_0'?'VEC2':'VEC3',5126)])),indices:append(indices,'SCALAR',5125),material:data.source.material,mode:4};
    });
    const materials=structuredClone(doc.materials),images=structuredClone(doc.images);for(const material of materials)if(material.name.endsWith('_leaves')){material.alphaMode='MASK';material.alphaCutoff=.45;images[doc.textures[material.pbrMetallicRoughness.baseColorTexture.index].source].uri='textures/'+name+'_leaves_rgba_512.png';}
    const result={...doc,materials,images,meshes:[{name:name+'_'+level,primitives}],bufferViews:views,accessors,buffers:[{uri:name+'_'+level+'.bin',byteLength}]},destination=path.join(output,name);await fs.mkdir(destination,{recursive:true});
    for(const [file,data]of [[name+'_'+level+'.gltf',Buffer.from(JSON.stringify(result))],[name+'_'+level+'.bin',Buffer.concat(chunks)]]){
      const p=path.join(destination,file);try{if(!(await fs.readFile(p)).equals(data))throw Error('Refuse changed existing candidate');}catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(p,data,{flag:'wx'});}
    }
    report.models[name].levels[level]={geometryBytes:byteLength,primitives:summaries,triangles:summaries.reduce((n,p)=>n+p.outputTriangles,0)};
  }
}
await fs.writeFile(path.join(output,'geometry-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
