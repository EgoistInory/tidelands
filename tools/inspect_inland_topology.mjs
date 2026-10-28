import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),report={models:{},productionIntegrated:false};
for(const name of ['jacaranda_tree']){
  const dir=path.join(root,'dist/inland-authored-source',name),doc=JSON.parse(await fs.readFile(path.join(dir,name+'_1k.gltf'),'utf8')),acquired=JSON.parse(await fs.readFile(path.join(dir,'acquisition.json'),'utf8'));
  if(createHash('sha256').update(await fs.readFile(path.join(dir,name+'_1k.gltf'))).digest('hex')!==acquired.files[name+'_1k.gltf'].sha256)throw Error('Source glTF changed');
  const buffer=await fs.readFile(path.join(dir,doc.buffers[0].uri));if(createHash('sha256').update(buffer).digest('hex')!==acquired.files[doc.buffers[0].uri].sha256)throw Error('Source buffer changed');
  const read=index=>{const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3}[a.type],size={5123:2,5125:4,5126:4}[a.componentType],result=a.componentType===5126?new Float32Array(a.count*width):new Uint32Array(a.count*width);if(!width||!size||a.sparse)throw Error('Unsupported accessor');for(let i=0;i<a.count;i++)for(let j=0;j<width;j++){const offset=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*width)+j*size;if(offset+size>buffer.length)throw Error('Accessor range');result[i*width+j]=a.componentType===5126?buffer.readFloatLE(offset):size===2?buffer.readUInt16LE(offset):buffer.readUInt32LE(offset);}return result;};
  const primitives=[];
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
    const positions=read(primitive.attributes.POSITION),indices=read(primitive.indices),parent=Uint32Array.from({length:positions.length/3},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    for(let i=0;i<indices.length;i+=3){const a=find(indices[i]);parent[find(indices[i+1])]=a;parent[find(indices[i+2])]=a;}
    const counts=new Map();for(let i=0;i<indices.length;i+=3){const p=find(indices[i]);counts.set(p,(counts.get(p)??0)+1);}
    const sorted=[...counts.values()].sort((a,b)=>a-b),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i++){min[i%3]=Math.min(min[i%3],positions[i]);max[i%3]=Math.max(max[i%3],positions[i]);}
    primitives.push({material:doc.materials[primitive.material].name,vertices:positions.length/3,triangles:indices.length/3,components:counts.size,componentTriangleQuantiles:[sorted[0],sorted[Math.floor(sorted.length*.5)],sorted[Math.floor(sorted.length*.95)],sorted.at(-1)],bounds:{min,max}});
  }
  report.models[name]={primitives,requiredExtensions:doc.extensionsRequired??[],nodes:doc.nodes};
}
await fs.writeFile(path.join(root,'docs/inland-authored-topology.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
