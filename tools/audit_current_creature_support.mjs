// Read-only evidence at actual enemy home positions; no gameplay state is persisted.
import fs from 'node:fs/promises';
import {createWorld,terrain} from '../src/world.js';
import {createCreature,animateCreature,resetCreature} from '../src/creature.js';
import {Vector3} from '../vendor/three.module.min.js';
const world=createWorld(),rows=[],models={boar:createCreature('boar'),crab:createCreature('crab')};
for(const enemy of world.enemies)for(const level of ['near','far']){
  const root=models[enemy.type];resetCreature(root);
  const actor={...enemy,attackAt:-100},target={x:enemy.x+(level==='far'?200:20),z:enemy.z+20};
  for(let frame=0;frame<60;frame++)animateCreature(root,actor,240+frame/60,1/60,terrain(actor.x,actor.z),target,null,terrain);
  root.updateMatrixWorld(true);const rig=root.userData,feet=rig.contacts.map(c=>c.point.clone().applyMatrix4(c.leg.matrixWorld)),gaps=feet.map(p=>p.y-terrain(p.x,p.z));
  let proxyMinVertexGap=null;if(rig.distant.visible){let min=Infinity;rig.distant.traverse(mesh=>{if(!mesh.isMesh)return;const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++){const p=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);min=Math.min(min,p.y-terrain(p.x,p.z));}});proxyMinVertexGap=min;}
  rows.push({id:enemy.id,type:enemy.type,level,actualFar:rig.far,position:[actor.x,actor.z],minFootGap:Math.min(...gaps),maxFootGap:Math.max(...gaps),proxyMinVertexGap,planted:rig.footContacts?.filter(Boolean).length??null,contacts:gaps.length,scope:'Idle at actual home terrain for60 ticks. Original articulated contacts plus visible distant proxy vertex minimum; no natural gameplay or motion-quality acceptance.'});
}
const result={enemies:world.enemies.length,samples:rows.length,over15cm:rows.filter(r=>r.minFootGap>.15||r.minFootGap<-.15),proxyOver15cm:rows.filter(r=>r.proxyMinVertexGap!==null&&(r.proxyMinVertexGap>.15||r.proxyMinVertexGap<-.15)),largestMaxGap:[...rows].sort((a,b)=>b.maxFootGap-a.maxFootGap).slice(0,5),allRows:rows,visualQualityAccepted:false};
await fs.writeFile(new URL('../docs/coastal-current-creature-support.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({enemies:result.enemies,samples:result.samples,over15cm:result.over15cm.length,proxyOver15cm:result.proxyOver15cm.length,worstProxy:result.proxyOver15cm.slice(0,2)}));
