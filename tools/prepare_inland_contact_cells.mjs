// Offline contact candidate. Keep source, runtime assets and world objects unchanged.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {woodySurfaceVoxels} from './coastal-wood-voxels.mjs';
import {woodyInteriorCells} from './inland-contact-volume.mjs';
import {createWorld} from '../src/world.js';
import {mergeFootprintCells} from '../src/resource-footprint.js';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'dist/inland-authored-component-candidate/jacaranda_tree'),audit=JSON.parse(await fs.readFile(path.join(root,'docs/inland-component-structure-audit.json'))),sha=b=>createHash('sha256').update(b).digest('hex'),occupied=new Set(),interiors=new Set(),rows=[];
for(const level of ['near','mid']){
 const doc=JSON.parse(await fs.readFile(path.join(folder,`jacaranda_tree_${level}.gltf`))),buffer=await fs.readFile(path.join(folder,`jacaranda_tree_${level}.bin`));if(sha(buffer)!==audit.rows.find(r=>r.level===level).sha256)throw Error('Geometry changed');
 const read=index=>{const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],w={VEC3:3,SCALAR:1}[a.type];if(!w||a.normalized||a.sparse||v.byteStride||![5125,5126].includes(a.componentType))throw Error('Unsupported contact accessor');const out=a.componentType===5126?new Float32Array(a.count*w):new Uint32Array(a.count*w),start=(v.byteOffset??0)+(a.byteOffset??0);for(let i=0;i<out.length;i++)out[i]=a.componentType===5126?buffer.readFloatLE(start+i*4):buffer.readUInt32LE(start+i*4);return out;};
 for(const primitive of doc.meshes[0].primitives){const material=doc.materials[primitive.material].name;if(material.endsWith('_leaves'))continue;const positions=read(primitive.attributes.POSITION),indices=read(primitive.indices),cells=woodySurfaceVoxels(positions,indices,.2);cells.forEach(c=>occupied.add(c.join(',')));let solid=null;if(material.endsWith('_trunk')){solid=woodyInteriorCells(positions,indices,.2);solid.cells.forEach(c=>interiors.add(c.join(',')));}rows.push({level,material,triangles:indices.length/3,surfaceCells:cells.length,interiorCells:solid?.cells.length??0,balancedLines:solid?.balancedLines??0,unbalancedLines:solid?.unbalancedLines??0});}
}
const surfaceCount=occupied.size;for(const key of interiors)occupied.add(key);
const cells=[...occupied].map(s=>s.split(',').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]),out=path.join(root,'dist/inland-authored-contact-candidate');await fs.mkdir(out,{recursive:true});
const merge=(cells,cell)=>{const bands=new Map();for(const c of cells){const band=Math.floor(c[1]/4);if(!bands.has(band))bands.set(band,[]);bands.get(band).push(c);}return [...bands.values()].flatMap(group=>mergeFootprintCells(group,cell));};
const coarse=[...new Set(cells.map(([x,y,z])=>[Math.floor(x/2),Math.floor(y/2),Math.floor(z/2)].join(',')))].map(s=>s.split(',').map(Number)),cameraBoxes=merge(coarse,.4),world=createWorld(),before=JSON.stringify(world.objects),selected=JSON.parse(await fs.readFile(path.join(root,'docs/inland-component-world-near.json'))),unit=2.95/1.8195863831788301,baseOffset=.146615132689476,placements=[];
// The two failed terrain-pruning attempts are archived in dist. Keep all wood instead.
const fineBase=cells.filter(c=>c[1]<16),coarseUpper=coarse.filter(c=>c[1]>=8),bodyBoxes=[...merge(fineBase,.2),...merge(coarseUpper,.4)];
if(bodyBoxes.length>10000)throw Error('Body footprint over existing box budget');
for(const id of selected.selectedIds){
 const node=world.objects.find(o=>o.id===id),scale=node.scale*unit,frame={x:node.x,y:node.y+baseOffset*scale,z:node.z,rotation:node.rotation,scale};placements.push({id,pose:[node.x,node.y,node.z,node.scale,node.rotation],frame});
}
if(cameraBoxes.length>10000||JSON.stringify(world.objects)!==before)throw Error('Camera budget or world mismatch');
const hashes={};for(const file of ['src/world.js','src/terrain-composition.js','src/resource-footprint.js'])hashes[file]=sha(await fs.readFile(path.join(root,file)));
const data={cell:.2,cameraCell:.4,unit,baseOffset,sourceHashes:hashes,bodyBoxes,cameraBoxes,placements,bodyCellPolicy:{lowerCell:.2,upperCell:.4,fineBelowNativeY:3.2,allSourceCellsConservativelyCovered:true},volumeRule:'Surface union plus balanced oriented X scan lines for trunk interior; ambiguous lines retain surface only',terrainCulling:false},bytes=Buffer.from(JSON.stringify(data)+'\n');await fs.writeFile(path.join(out,'inland-contact-shapes.json'),bytes);await fs.writeFile(path.join(out,'wood-contact-cells.json'),JSON.stringify({cell:.2,cells})+'\n');
const report={verifiedGeometry:true,rows,unionSurfaceCells:surfaceCount,unionContactCells:cells.length,interiorCells:interiors.size,cameraCells:coarse.length,cameraBoxes:cameraBoxes.length,bodyBoxes:bodyBoxes.length,fineBasalCells:fineBase.length,coarseUpperCells:coarseUpper.length,placements:placements.map(p=>({id:p.id,frame:p.frame})),fileBytes:bytes.length,sha256:sha(bytes),sourceHashes:hashes,sourceAndRuntimeUnchanged:true,filledBalancedScanLinesOnly:true,productionIntegrated:false,bodyContactAccepted:false};await fs.writeFile(path.join(root,'docs/inland-contact-cell-preparation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
