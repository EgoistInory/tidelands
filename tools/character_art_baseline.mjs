import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';
const root=createCharacter();animateCharacter(root,{x:0,z:0,yaw:0,time:10,attackAt:-100,selected:'hand'},0,()=>0);root.updateMatrixWorld(true);
const bounds=new THREE.Box3(),geometries=new Map();let meshes=0;
root.traverseVisible(mesh=>{if(!mesh.isMesh)return;meshes++;mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));geometries.set(mesh.geometry.uuid,mesh.geometry);});
const head=root.userData.body.children.find(mesh=>mesh.isMesh&&mesh.geometry.type==='SphereGeometry'&&mesh.geometry.parameters.radius===.3);
const headBounds=head.geometry.boundingBox.clone().applyMatrix4(head.matrixWorld),size=bounds.getSize(new THREE.Vector3()),headSize=headBounds.getSize(new THREE.Vector3());
const types={};let triangles=0,geometryArrayBytes=0;
for(const geometry of geometries.values()){types[geometry.type]=(types[geometry.type]??0)+1;triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;geometryArrayBytes+=Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(geometry.index?.array.byteLength??0);}
const report={kind:'visible-production-character-art-baseline',sourceSha256:createHash('sha256').update(readFileSync(new URL('../src/character.js',import.meta.url))).digest('hex'),pose:'hand idle time10, flat ground',meshes,uniqueGeometries:geometries.size,types,triangles,geometryArrayBytes,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:size.toArray()},headBounds:{min:headBounds.min.toArray(),max:headBounds.max.toArray(),size:headSize.toArray()},headHeightsPerVisibleHeight:size.y/headSize.y,hiddenToolsExcluded:true,limits:['Numerical geometry/proportion baseline, not adult anatomy or visual acceptance.','CPU typed-array bytes, not GPU/driver memory.','No game state, save or production changes.']};
writeFileSync(new URL('../docs/character-art-baseline-numerical.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
