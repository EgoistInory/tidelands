// Conservative geometry screening, not a replacement for actual swept-body traversal.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createWorld,LANDMARKS,SPAWN} from '../src/world.js';
import {islandTreeAppearance} from '../src/landscape.js';
import {woodySurfaceVoxels} from './coastal-wood-voxels.mjs';
const unit=2.95/1.8195863831788301,world=createWorld(),models=[];
const chosen=world.objects.filter(o=>o.type==='tree'&&['coast','shoal'].includes(islandTreeAppearance(o).form)&&!o.id.startsWith('starter')&&Math.hypot(o.x-SPAWN.x,o.z-SPAWN.z)>18&&!LANDMARKS.some(l=>Math.hypot(o.x-l.x,o.z-l.z)<12));
for(const name of ['island_tree_01','island_tree_02','island_tree_03']){
  const dir=`dist/canopy-authored-candidate/${name}`,doc=JSON.parse(await fs.readFile(`${dir}/${name}_near.gltf`,'utf8')),buffer=await fs.readFile(`${dir}/${doc.buffers[0].uri}`);
  const read=index=>{const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],width=a.type==='VEC3'?3:1,start=(v.byteOffset??0)+(a.byteOffset??0),array=a.componentType===5126?new Float32Array(a.count*width):new Uint32Array(a.count*width);for(let i=0;i<array.length;i++)array[i]=a.componentType===5126?buffer.readFloatLE(start+i*4):buffer.readUInt32LE(start+i*4);return array;};
  const primitives=doc.meshes[0].primitives.map(p=>({positions:read(p.attributes.POSITION),indices:read(p.indices)}));
  let minY=Infinity,maxY=-Infinity;for(const {positions:p}of primitives)for(let i=1;i<p.length;i+=3){minY=Math.min(minY,p[i]);maxY=Math.max(maxY,p[i]);}
  models.push({name,minY,maxY,wood:[primitives[0],primitives[2]],sha256:createHash('sha256').update(buffer).digest('hex')});
}
const rows=chosen.map((node,i)=>{
  const model=models[i%3],scale=node.scale*unit,ceiling=model.minY+2.95/scale;let radius=0,witness=null;
  function consider(x,y,z){const r=Math.hypot(x,z)*scale;if(r>radius){radius=r;witness=[x*scale,(y-model.minY)*scale,z*scale];}}
  for(const {positions:p,indices:ix}of model.wood){
    for(let j=0;j<p.length;j+=3)if(p[j+1]<=ceiling)consider(p[j],p[j+1],p[j+2]);
    // Include exact intersections of woody triangle edges with the body-height plane.
    for(let j=0;j<ix.length;j+=3)for(let edge=0;edge<3;edge++){
      const a=ix[j+edge]*3,b=ix[j+(edge+1)%3]*3,ya=p[a+1],yb=p[b+1];if((ya<ceiling)===(yb<ceiling)||ya===yb)continue;
      const t=(ceiling-ya)/(yb-ya);consider(p[a]+(p[b]-p[a])*t,ceiling,p[a+2]+(p[b+2]-p[a+2])*t);
    }
  }
  return {id:node.id,model:model.name,worldScale:scale,nativeHeight:(model.maxY-model.minY),worldHeight:(model.maxY-model.minY)*scale,oldBodyRadius:1.15,woodRadiusBelowAvatarHeight:radius,witnessLocalWorldUnits:witness,exceedsOldBodyEnvelope:radius>1.15};
});
const voxelData={cellSize:.2,unitFactor:unit,models:{},productionIntegrated:false,collisionAccepted:false};
for(const model of models){
  const cells=new Set();for(const primitive of model.wood)for(const row of woodySurfaceVoxels(primitive.positions,primitive.indices,.2))cells.add(row.join(','));
  voxelData.models[model.name]={geometrySha256:model.sha256,minY:model.minY,occupiedCells:[...cells].map(key=>key.split(',').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2])};
}
const voxelPath='dist/canopy-authored-candidate/woody-surface-voxels.json',voxelBytes=Buffer.from(JSON.stringify(voxelData)+'\n');
try{const old=await fs.readFile(voxelPath);if(!old.equals(voxelBytes))throw Error('Refuse different existing voxel output');}catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(voxelPath,voxelBytes,{flag:'wx'});}
const report={unitFactor:unit,avatarWorldHeight:2.95,selectedNodes:rows.length,exceedsOldBodyEnvelope:rows.filter(r=>r.exceedsOldBodyEnvelope).length,rows,modelGeometrySha256:Object.fromEntries(models.map(m=>[m.name,m.sha256])),woodySurfaceVoxels:{path:voxelPath,bytes:voxelBytes.length,sha256:createHash('sha256').update(voxelBytes).digest('hex'),cellSize:.2,occupiedCells:Object.fromEntries(Object.entries(voxelData.models).map(([name,data])=>[name,data.occupiedCells.length]))},productionIntegrated:false,bodyCollisionAccepted:false,scope:'Actual near woody triangles clipped at avatar height above each flat model ground. Max radial extent screens old fixed1.15 circle. Full-height woody surface voxels use actual triangle/box intersection and preserve empty forks. No body radius, terrain slope, root fitting, sweep collision, gather/build or saved gameplay acceptance.'};
await fs.writeFile('docs/coastal-contact-screening.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({selectedNodes:report.selectedNodes,exceedsOldBodyEnvelope:report.exceedsOldBodyEnvelope,models:models.map(m=>({name:m.name,minY:m.minY,maxY:m.maxY})),radii:[Math.min(...rows.map(r=>r.woodRadiusBelowAvatarHeight)),Math.max(...rows.map(r=>r.woodRadiusBelowAvatarHeight))]}));
