// Offline only. Pinned MIT meshoptimizer; original CC0 files are never overwritten.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),source=path.join(root,'dist/forest-collection-source'),out=path.join(root,'dist/forest-collection-candidate');
const tool=path.join(root,'tools/vendor/meshoptimizer-0.24/meshopt_simplifier.mjs'),expected='68f7b94830e3be31b7f08eb09c01b5c3867c74437d27807629541b3874bab567';
const sha=b=>createHash('sha256').update(b).digest('hex');
if(sha(await fs.readFile(tool))!==expected)throw Error('Pinned offline simplifier checksum mismatch');
const {MeshoptSimplifier:M}=await import(pathToFileURL(tool));await M.ready;
const manifest=JSON.parse(await fs.readFile(path.join(source,'manifest.json'),'utf8')),report={tool:{version:'meshoptimizer v0.24',sha256:expected,license:'MIT',source:'https://github.com/zeux/meshoptimizer/tree/v0.24'},models:{},productionIntegrated:false,visualAccepted:false};
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},constructors={5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
await fs.mkdir(out,{recursive:true});
for(const name of ['fir_sapling','fern_02','rock_moss_set_01']){
  const folder=path.join(source,name),doc=JSON.parse(await fs.readFile(path.join(folder,name+'_1k.gltf'),'utf8'));
  const buffers=await Promise.all(doc.buffers.map(async b=>{
    if(path.basename(b.uri)!==b.uri)throw Error('Unexpected buffer URI');const data=await fs.readFile(path.join(folder,b.uri));
    if(sha(data)!==manifest.files[name+'/'+b.uri].sha256)throw Error('Original buffer changed');return data;
  }));
  const read=index=>{const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],C=constructors[a.componentType],w=widths[a.type];
    if(!C||!w||a.sparse||a.normalized)throw Error('Unsupported accessor');const stride=v.byteStride??w*C.BYTES_PER_ELEMENT,data=buffers[v.buffer];
    const result=new C(a.count*w);for(let i=0;i<a.count;i++)for(let j=0;j<w;j++){
      const offset=(v.byteOffset??0)+(a.byteOffset??0)+i*stride+j*C.BYTES_PER_ELEMENT;
      if(offset+C.BYTES_PER_ELEMENT>data.length)throw Error('Accessor outside source');
      result[i*w+j]=C===Float32Array?data.readFloatLE(offset):C===Uint16Array?data.readUInt16LE(offset):data.readUInt32LE(offset);
    }return result;};
  const chunks=[],views=[],accessors=[];let bytes=0;const summary=[];
  const append=(array,type,componentType)=>{const buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength),padding=(4-bytes%4)%4;
    if(padding){chunks.push(Buffer.alloc(padding));bytes+=padding;}const offset=bytes;chunks.push(buffer);bytes+=buffer.length;
    const view=views.push({buffer:0,byteOffset:offset,byteLength:buffer.length})-1,a={bufferView:view,componentType,count:array.length/widths[type],type};
    if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++){a.min[i%3]=Math.min(a.min[i%3],array[i]);a.max[i%3]=Math.max(a.max[i%3],array[i]);}}
    return accessors.push(a)-1;
  };
  const meshes=doc.meshes.map((mesh,mi)=>({name:mesh.name,primitives:mesh.primitives.map((primitive,pi)=>{
    const attributes=Object.fromEntries(Object.entries(primitive.attributes).map(([k,v])=>[k,read(v)]));let indices=new Uint32Array(read(primitive.indices)),error=0;
    const triangles=indices.length/3,target=name==='fir_sapling'?(pi===0?triangles:8000):name==='rock_moss_set_01'?1800:triangles;
    if(triangles>target){
      const count=attributes.POSITION.length/3,attrs=new Float32Array(count*5);for(let i=0;i<count;i++){attrs.set(attributes.NORMAL.subarray(i*3,i*3+3),i*5);attrs.set(attributes.TEXCOORD_0.subarray(i*2,i*2+2),i*5+3);}
      [indices,error]=M.simplifyWithAttributes(indices,attributes.POSITION,3,attrs,5,[.25,.25,.25,.1,.1],null,Math.floor(target)*3,.025,['Prune']);
    }
    const outputTriangles=indices.length/3,[remap,count]=M.compactMesh(indices),newAttrs={};
    for(const [key,array]of Object.entries(attributes)){const w=key==='TEXCOORD_0'?2:3,compact=new Float32Array(count*w);for(let i=0;i<remap.length;i++)if(remap[i]<count)compact.set(array.subarray(i*w,i*w+w),remap[i]*w);newAttrs[key]=append(compact,'VEC'+w,5126);}
    summary.push({mesh:mi,primitive:pi,inputTriangles:triangles,outputTriangles,relativeError:error,vertices:count});
    return {attributes:newAttrs,indices:append(indices,'SCALAR',5125),material:primitive.material,mode:4};
  })}));
  const result={...doc,meshes,bufferViews:views,accessors,buffers:[{uri:name+'.bin',byteLength:bytes}]};
  // Keep variants individually selectable and remove only their author's display-grid offsets in the QA renderer.
  delete result.extensionsRequired;
  const destination=path.join(out,name);await fs.mkdir(destination,{recursive:true});
  const write=async(file,data)=>{try{const prior=await fs.readFile(path.join(destination,file));if(!prior.equals(data))throw Error('Refuse changed existing candidate '+file);}catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(path.join(destination,file),data,{flag:'wx'});}};
  await write(name+'.gltf',Buffer.from(JSON.stringify(result)));await write(name+'.bin',Buffer.concat(chunks));
  report.models[name]={primitives:summary,geometryBytes:bytes,inputTriangles:summary.reduce((s,v)=>s+v.inputTriangles,0),outputTriangles:summary.reduce((s,v)=>s+v.outputTriangles,0)};
}
await fs.writeFile(path.join(out,'geometry-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
