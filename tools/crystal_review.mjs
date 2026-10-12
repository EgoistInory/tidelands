// Static mesh/volume evidence only, not surface contact or world GPU performance.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {createCrystalDeposit} from '../src/crystal.js';
const model=createCrystalDeposit();model.updateMatrixWorld(true);
const box=new THREE.Box3().setFromObject(model),parts=model.children.map(mesh=>({name:mesh.name,
  triangles:(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,
  vertices:mesh.geometry.attributes.position.count,
  attributeBytes:Object.values(mesh.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0),
  indexBytes:mesh.geometry.index?.array.byteLength??0,vertexColors:mesh.material.vertexColors,
  transparent:mesh.material.transparent,roughness:mesh.material.roughness,metalness:mesh.material.metalness}));
const files=['src/crystal.js','src/scene.js'];
const report={kind:'static-crystal-review',fullGoalComplete:false,scope:'Local fixed mineral geometry, two instanced parts. No GPU/driver memory or full world performance proof.',
  bounds:{min:box.min.toArray(),max:box.max.toArray()},parts,totalTriangles:parts.reduce((n,p)=>n+p.triangles,0),
  totalGeometryBytes:parts.reduce((n,p)=>n+p.attributeBytes+p.indexBytes,0),
  sourceSha256:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(new URL('../'+f,import.meta.url))).digest('hex')]))};
writeFileSync(new URL('../docs/crystal-numerical.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
