// Offline, reproducible actual-source pose probe; no image decode, GL or gameplay claims.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {captureAuthorRest,retargetAuthoredClips} from '../src/authored-retarget.js';
import {dressAuthoredAvatar,WARDROBE_ROLES} from '../src/authored-wardrobe.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function accessor(doc,buffer,index){
  const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType];
  const types={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},data=new types[a.componentType](a.count*components),offset=(v.byteOffset??0)+(a.byteOffset??0),view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength),get={5121:'getUint8',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a.componentType];
  for(let i=0;i<a.count;i++)for(let k=0;k<components;k++)data[i*components+k]=view[get](offset+i*(v.byteStride??components*size)+k*size,true);
  return{array:data,itemSize:components,normalized:!!a.normalized};
}
function body(sex){
  const d=JSON.parse(read('dist/authored-review/Superhero_'+sex+'_FullBody.gltf')),b=read('dist/authored-review/'+d.buffers[0].uri);
  const nodes=d.nodes.map(n=>{const o=new THREE.Bone();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});
  d.nodes.forEach((n,i)=>(n.children??[]).forEach(j=>nodes[i].add(nodes[j])));const scene=new THREE.Group();for(const i of d.scenes[0].nodes)scene.add(nodes[i]);scene.updateMatrixWorld(true);
  const skin=d.skins[0],inverse=accessor(d,b,skin.inverseBindMatrices).array,skeleton=new THREE.Skeleton(skin.joints.map(i=>nodes[i]),skin.joints.map((_,i)=>new THREE.Matrix4().fromArray(inverse,i*16)));
  const p=d.meshes[2].primitives[0],geometry=new THREE.BufferGeometry(),names={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',JOINTS_0:'skinIndex',WEIGHTS_0:'skinWeight'};
  for(const [key,name]of Object.entries(names)){const a=accessor(d,b,p.attributes[key]);geometry.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize,a.normalized));}geometry.setIndex(new THREE.BufferAttribute(accessor(d,b,p.indices).array,1));
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());mesh.name='Superhero_'+sex;nodes[68].add(mesh);mesh.bind(skeleton,new THREE.Matrix4());return{scene,mesh};
}
const glb=read('dist/authored-review/UAL1_Standard.glb'),jsonSize=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+jsonSize)),binary=glb.subarray(28+jsonSize);
const clips=doc.animations.map(a=>new THREE.AnimationClip(a.name,-1,a.channels.map(c=>{const s=a.samplers[c.sampler],time=accessor(doc,binary,s.input).array,value=accessor(doc,binary,s.output).array,type=c.target.path==='rotation'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;return new type(doc.nodes[c.target.node].name+'.'+{translation:'position',rotation:'quaternion',scale:'scale'}[c.target.path],time,value);})));
const referenceNodes=doc.nodes.map(n=>{const b=new THREE.Bone();b.name=n.name;if(n.translation)b.position.fromArray(n.translation);if(n.rotation)b.quaternion.fromArray(n.rotation);if(n.scale)b.scale.fromArray(n.scale);return b;});
doc.nodes.forEach((n,i)=>(n.children??[]).forEach(j=>referenceNodes[i].add(referenceNodes[j])));const referenceRoot=new THREE.Group();for(const i of doc.scenes[0].nodes)referenceRoot.add(referenceNodes[i]);
const referenceRest=captureAuthorRest(referenceRoot),referencePositions=doc.meshes.flatMap(m=>m.primitives.map(p=>doc.accessors[p.attributes.POSITION])),referenceHeight=Math.max(...referencePositions.map(p=>p.max[1]))-Math.min(...referencePositions.map(p=>p.min[1]));
const rows=[];
for(const [role,style]of Object.entries(WARDROBE_ROLES)){
  const {scene,mesh}=body(style.sex==='male'?'Male':'Female'),before=sha(Buffer.from(mesh.geometry.attributes.position.array.buffer)),outfit=dressAuthoredAvatar(scene,role),mixer=new THREE.AnimationMixer(scene);let samples=0,minY=Infinity,maxY=-Infinity;
  const retargeted=retargetAuthoredClips(scene,referenceRest,clips,outfit.userData.height/referenceHeight);
  for(const clip of retargeted){mixer.stopAllAction();mesh.skeleton.pose();const action=mixer.clipAction(clip).reset().play();
    for(let frame=0;frame<10;frame++){action.time=clip.duration*frame/10;mixer.update(0);scene.updateMatrixWorld(true);mesh.skeleton.update();
      outfit.traverse(o=>{if(!o.isSkinnedMesh)return;const count=o.geometry.attributes.position.count;for(let i=0;i<count;i+=Math.max(1,Math.floor(count/24))){const p=o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld);if(!p.toArray().every(Number.isFinite))throw Error('Nonfinite garment pose');minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);samples++;}});
    }
  }
  if(before!==sha(Buffer.from(mesh.geometry.attributes.position.array.buffer)))throw Error('Body source mutated');
  const meshes=[];outfit.traverse(o=>{if(o.isSkinnedMesh){const w=o.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++){const sum=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)].reduce((a,b)=>a+b);if(Math.abs(sum-1)>.00001)throw Error('Unnormalized garment skin');}meshes.push({name:o.name,triangles:o.geometry.index.count/3,vertices:o.geometry.attributes.position.count});}});
  rows.push({role,referenceHeight,bodyRatio:outfit.userData.height/referenceHeight,clips:clips.length,poses:clips.length*10,vertexSamples:samples,rangeY:[minY,maxY],sourcePositionsUnchanged:true,sourceWeightsNormalized:true,meshes,scope:'Sampled numeric source motion only; not visual clipping, collision, ground support or motion quality acceptance'});
}
const report={rows,files:Object.fromEntries(['src/authored-wardrobe.js','src/authored-retarget.js','src/textile.js','tools/probe_authored_wardrobe.mjs'].map(p=>[p,sha(read(p))])),runtimeIntegrated:false,fullGoalComplete:false};fs.writeFileSync(new URL('docs/authored-wardrobe-cpu.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(rows.map(({role,clips,poses,vertexSamples,rangeY})=>({role,clips,poses,vertexSamples,rangeY}))));
