// Bind shipped contact metadata only to the independent Node planner's copied world.
import fs from 'node:fs';
import {terrain,SPAWN,LANDMARKS} from '../src/world.js';
import {islandTreeAppearance} from '../src/landscape.js';
import {registerFootprint,mergeFootprintCells} from '../src/resource-footprint.js';
export function bindCampaignContacts(world){
 const data=JSON.parse(fs.readFileSync(new URL('../assets/coastal/woody-surface-voxels.json',import.meta.url))),names=['island_tree_01','island_tree_02','island_tree_03'],boxes=names.map(n=>mergeFootprintCells(data.models[n].occupiedCells,data.cellSize));
 const chosen=world.objects.filter(o=>o.type==='tree'&&['coast','shoal'].includes(islandTreeAppearance(o).form)&&!o.id.startsWith('starter')&&Math.hypot(o.x-SPAWN.x,o.z-SPAWN.z)>18&&!LANDMARKS.some(l=>Math.hypot(o.x-l.x,o.z-l.z)<12)),releases=[];
 for(const [i,node]of chosen.entries()){const model=data.models[names[i%3]],scale=node.scale*(2.95/1.8195863831788301);releases.push(registerFootprint(node,boxes[i%3],terrain,{x:node.x,y:node.y-model.minY*scale,z:node.z,rotation:node.rotation,scale}));}
 const inland=JSON.parse(fs.readFileSync(new URL('../assets/inland/inland-contact-shapes.json',import.meta.url)));
 for(const p of inland.placements){const node=world.objects.find(o=>o.id===p.id);releases.push(registerFootprint(node,inland.bodyBoxes,terrain,{...p.frame,y:node.y+p.frame.y-p.pose[1]}));}
 return {coastal:chosen.length,inland:inland.placements.length,release:()=>releases.forEach(fn=>fn())};
}
