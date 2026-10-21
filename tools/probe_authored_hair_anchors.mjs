// Derive origin-space hair anchors from the matching author rig stored in the fixed CC0 archive.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';import crypto from'node:crypto';import * as THREE from '../vendor/three.module.min.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=execFileSync('python3',['-c',`import json,zipfile,hashlib,sys
from pathlib import Path
p=Path(sys.argv[1]);b=p.read_bytes()
assert hashlib.sha256(b).hexdigest()=='fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40'
with zipfile.ZipFile(p)as z:
 out={}
 for h in ['Hair_Buns','Hair_Buzzed','Hair_Long','Hair_SimpleParted']:
  s=z.read('Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/'+h+'.gltf');out[h]={'doc':json.loads(s),'sha256':hashlib.sha256(s).hexdigest()}
 print(json.dumps(out))`,path.join(root,'dist/authored-source/Universal Base Characters[Standard].zip')],{maxBuffer:1024*1024,timeout:30000});
const rows={};for(const[h,{doc,sha256}]of Object.entries(JSON.parse(source))){const nodes=doc.nodes.map(n=>{const o=new THREE.Object3D();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});doc.nodes.forEach((n,i)=>(n.children??[]).forEach(j=>nodes[i].add(nodes[j])));const scene=new THREE.Group();doc.scenes[0].nodes.forEach(i=>scene.add(nodes[i]));scene.updateMatrixWorld(true);const origin=JSON.parse(fs.readFileSync(path.join(root,'dist/authored-hair/'+h+'.gltf'))),n=origin.nodes[0],matrix=new THREE.Matrix4().compose(new THREE.Vector3().fromArray(n.translation??[0,0,0]),new THREE.Quaternion().fromArray(n.rotation??[0,0,0,1]),new THREE.Vector3().fromArray(n.scale??[1,1,1])),a=origin.accessors[origin.meshes[0].primitives[0].attributes.POSITION],bounds=new THREE.Box3(new THREE.Vector3().fromArray(a.min),new THREE.Vector3().fromArray(a.max)).applyMatrix4(matrix);if(bounds.max.y>2||bounds.min.y<1.4)throw Error('Unexpected source hair world extent');rows[h]={originNodeRotation:n.rotation??[0,0,0,1],originNodeScale:n.scale??[1,1,1],sourceWorldBounds:[bounds.min.toArray(),bounds.max.toArray()],riggedSourceGltfSha256:sha256,headBindPosition:nodes.find(n=>n.name==='Head').getWorldPosition(new THREE.Vector3()).toArray()};}
fs.writeFileSync(path.join(root,'docs/authored-hair-bind-anchors.json'),JSON.stringify({rows,source:'Fixed CC0 base archive; actual corresponding rigged hairstyle head world transforms',scriptSha256:crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')},null,2)+'\n');console.log(JSON.stringify(rows));
