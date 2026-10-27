import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base=new URL('../dist/coastal-contact-r2/tidelands-local/src/',import.meta.url),game=await import(new URL('game.js',base)),legacyGame=await import(new URL('../src/game.js',import.meta.url)),{createWorld,terrain,SPAWN,LANDMARKS}=await import(new URL('world.js',base)),{islandTreeAppearance}=await import(new URL('landscape.js',base)),{registerFootprint,mergeFootprintCells,footprintReach,footprintBlocksMove,footprintGatherTarget,footprintBoxes}=await import(new URL('resource-footprint.js',base));
const data=JSON.parse(await fs.readFile(new URL('../dist/canopy-authored-candidate/woody-surface-voxels.json',import.meta.url),'utf8')),world=createWorld(),names=Object.keys(data.models),selected=world.objects.filter(o=>o.type==='tree'&&['coast','shoal'].includes(islandTreeAppearance(o).form)&&!o.id.startsWith('starter')&&Math.hypot(o.x-SPAWN.x,o.z-SPAWN.z)>18&&!LANDMARKS.some(l=>Math.hypot(o.x-l.x,o.z-l.z)<12)),merged=Object.fromEntries(names.map(name=>[name,mergeFootprintCells(data.models[name].occupiedCells,.2)]));
selected.forEach((o,i)=>{const model=data.models[names[i%3]],scale=o.scale*data.unitFactor;registerFootprint(o,merged[names[i%3]],terrain,{x:o.x,y:o.y-model.minY*scale,z:o.z,rotation:o.rotation,scale});});
const state=game.freshGame();state.enemies=[];Object.assign(state.inventory,{wood:30,stone:30,fiber:30,axe:1});state.quest=6;
const node=selected[0];let witness=null;
for(let x=node.x-7;x<=node.x+7&&!witness;x+=.2)for(let z=node.z-7;z<=node.z+7&&!witness;z+=.2){
  const p={x,z},gap=footprintReach(p,node)-1.8,to={x,z:z+.8};if(gap<.45||gap>.9||Math.hypot(x-node.x,z-node.z)<3||!footprintBlocksMove(p,to,node))continue;
  Object.assign(state.player,p);if(game.nearest(state,world.objects)?.id!==node.id)continue;
  const target=footprintGatherTarget(p,node);if(target.y-terrain(p.x,p.z)>2.2)continue;
  let robust=true;for(const dt of [1/60,1/30,.05]){const probe=structuredClone(state);game.movePlayer(probe,world.objects,0,1,.06);for(let i=0;i<Math.ceil(.6/dt);i++)game.movePlayer(probe,world.objects,0,1,dt);if(probe.player.z-p.z>1.4)robust=false;}if(!robust)continue;
  const buildState=structuredClone(state);Object.assign(buildState.player,{x:target.x,z:target.z-6});
  if(game.canBuild(buildState,[],'campfire',target.x,target.z)!=='')continue;
  witness={nodeId:node.id,model:names[0],start:p,to,target,gap,oldCentreDistance:Math.hypot(x-node.x,z-node.z)};
}
if(!witness)throw Error('No safe actual branch witness found');
let blocked=null;
findBuilding:for(const [index,tree]of selected.entries())for(const [min,max]of footprintBoxes(tree)){
  const x=(min[0]+max[0])/2,z=(min[2]+max[2])/2,centreDistance=Math.hypot(x-tree.x,z-tree.z);if(centreDistance<3.3)continue;
  Object.assign(state.player,{x,z:z-6});if(legacyGame.canBuild(state,world.objects,'campfire',x,z)!=='')continue;
  const error=game.canBuild(state,[tree],'campfire',x,z);if(!/树木|岩石/.test(error))continue;
  blocked={nodeId:tree.id,model:names[index%3],start:{x,z:z-6},target:{x,y:terrain(x,z),z},oldCentreDistance:centreDistance,baselineCanBuild:'',candidateError:error};break findBuilding;
}
if(!blocked)throw Error('No actual low-wood building witness beyond old centre clearance');
let clear=null;for(let x=-110;x<-70&&!clear;x+=3)for(let z=108;z<132&&!clear;z+=3){Object.assign(state.player,{x,z:z-6});if(game.canBuild(state,world.objects,'campfire',x,z)==='')clear={x,z};}
if(!clear)throw Error('No clear camp witness found');
const result={branch:witness,blocked,clear,selectedNodes:selected.length,mergedBoxes:Object.fromEntries(names.map(n=>[n,merged[n].length])),scope:'Declared actual authored resource/branch and clear-ground fixtures; no ordinary save input or runtime teleport during input sequence.'};
await fs.writeFile(fileURLToPath(new URL('../docs/coastal-contact-fixtures.json',import.meta.url)),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
