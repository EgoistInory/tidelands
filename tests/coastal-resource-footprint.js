// Candidate template; production uses its existing rules until the isolated path is accepted.
import {terrain} from '../src/world.js';
import {GATHER_RANGE} from '../src/action-timing.js';
const footprints=new WeakMap();
export function mergeFootprintCells(cells,cell=.2){
  if(!Number.isFinite(cell)||cell<.05||cell>1||!cells.length||cells.length>10000||cells.some(r=>r.length!==3||!r.every(Number.isInteger)))throw Error('Invalid footprint grid');
  const occupied=new Set(cells.map(r=>r.join(','))),boxes=[],has=(x,y,z)=>occupied.has(`${x},${y},${z}`);
  for(const [x,y,z]of [...cells].sort((a,b)=>a[1]-b[1]||a[2]-b[2]||a[0]-b[0])){
    if(!has(x,y,z))continue;let xx=x+1,zz=z+1,yy=y+1;while(has(xx,y,z))xx++;
    while(Array.from({length:xx-x},(_,i)=>has(x+i,y,zz)).every(Boolean))zz++;
    while(Array.from({length:(xx-x)*(zz-z)},(_,i)=>has(x+i%(xx-x),yy,z+Math.floor(i/(xx-x)))).every(Boolean))yy++;
    for(let a=x;a<xx;a++)for(let b=y;b<yy;b++)for(let c=z;c<zz;c++)occupied.delete(`${a},${b},${c}`);
    boxes.push([[x*cell,y*cell,z*cell],[xx*cell,yy*cell,zz*cell]]);
  }return boxes;
}
export function registerFootprint(object,boxes,groundAt=terrain,frame={x:0,y:0,z:0,rotation:0,scale:1}){
  if(object?.type!=='tree'||![object.x,object.z,frame.x,frame.y,frame.z,frame.rotation,frame.scale].every(Number.isFinite)||frame.scale<=0||frame.scale>100||!Array.isArray(boxes)||!boxes.length||boxes.length>10000||typeof groundAt!=='function')throw Error('Invalid tree footprint');
  const clean=boxes.map(box=>{if(!Array.isArray(box)||box.length!==2||box.some(v=>!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite))||box[0].some((v,i)=>v>=box[1][i]))throw Error('Invalid footprint box');return Object.freeze(box.map(v=>Object.freeze([...v])));});
  const {x,y,z,rotation,scale}=frame,c=Math.cos(rotation),s=Math.sin(rotation),local=p=>({x:(c*(p.x-x)-s*(p.z-z))/scale,z:(s*(p.x-x)+c*(p.z-z))/scale}),ground=p=>(groundAt(p.x,p.z)-y)/scale;
  const worldBoxes=clean.map(([min,max])=>{const points=[[min[0],min[2]],[min[0],max[2]],[max[0],min[2]],[max[0],max[2]]].map(([a,b])=>[x+scale*(c*a+s*b),z+scale*(-s*a+c*b)]);return Object.freeze([Object.freeze([Math.min(...points.map(p=>p[0])),y+min[1]*scale,Math.min(...points.map(p=>p[1]))]),Object.freeze([Math.max(...points.map(p=>p[0])),y+max[1]*scale,Math.max(...points.map(p=>p[1]))])]);});
  const reach=Math.max(...worldBoxes.flatMap(([min,max])=>[Math.hypot(min[0]-object.x,min[2]-object.z),Math.hypot(min[0]-object.x,max[2]-object.z),Math.hypot(max[0]-object.x,min[2]-object.z),Math.hypot(max[0]-object.x,max[2]-object.z)]));
  const world=p=>({x:x+scale*(c*p.x+s*p.z),y:y+scale*p.y,z:z+scale*(-s*p.x+c*p.z)});
  footprints.set(object,{boxes:Object.freeze(clean),worldBoxes:Object.freeze(worldBoxes),local,world,ground,scale,reach});
}
export function footprintBoxes(object){return footprints.get(object)?.worldBoxes??null;}
export function copyFootprint(from,to){const shape=footprints.get(from);if(shape)footprints.set(to,shape);return to;}
export function footprintGatherTarget(player,object){
  const shape=footprints.get(object);if(!shape)return null;const p=shape.local(player),ground=shape.ground(player),y=ground+1.1/shape.scale;let best=null,bestDistance=Infinity;
  for(const [min,max]of withinHeight(shape.boxes,ground,ground+2.95/shape.scale)){
    const point={x:Math.max(min[0],Math.min(max[0],p.x)),y:Math.max(min[1],Math.min(max[1],y)),z:Math.max(min[2],Math.min(max[2],p.z))},d=(point.x-p.x)**2+(point.y-y)**2+(point.z-p.z)**2;
    if(d<bestDistance){bestDistance=d;best=point;}
  }return best?shape.world(best):null;
}
const withinHeight=(boxes,bottom,top)=>boxes.filter(([min,max])=>max[1]>bottom+.02&&min[1]<top);
function inside(p,[min,max],r){return p.x>min[0]-r&&p.x<max[0]+r&&p.z>min[2]-r&&p.z<max[2]+r;}
function crosses(from,to,[min,max],r){
  let enter=0,leave=1;
  for(const [start,end,lo,hi]of [[from.x,to.x,min[0]-r,max[0]+r],[from.z,to.z,min[2]-r,max[2]+r]]){
    const delta=end-start;if(Math.abs(delta)<1e-12){if(start<=lo||start>=hi)return false;continue;}
    const a=(lo-start)/delta,b=(hi-start)/delta;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));if(enter>=leave)return false;
  }return enter<1&&leave>0;
}
export function footprintBlocksMove(from,to,object,radius=.35,height=2.95){
  const shape=footprints.get(object);if(!shape)return null;
  const dx=to.x-from.x,dz=to.z-from.z,fx=from.x-object.x,fz=from.z-object.z;
  if(Math.hypot(fx,fz)>shape.reach+radius+Math.hypot(dx,dz))return false;
  const a=shape.ground(from),b=shape.ground(to),boxes=withinHeight(shape.boxes,Math.min(a,b),Math.max(a,b)+height/shape.scale),start=shape.local(from),end=shape.local(to),r=radius/shape.scale;
  // Same outward-escape convention as legacy circle contacts; never relocate a saved actor.
  if(boxes.some(box=>inside(start,box,r)))return fx*dx+fz*dz< -1e-10;
  if(dx*dx+dz*dz<1e-18)return false;
  return boxes.some(box=>crosses(start,end,box,r));
}
function distance(p,[min,max]){return Math.hypot(Math.max(0,min[0]-p.x,p.x-max[0]),Math.max(0,min[2]-p.z,p.z-max[2]));}
export function footprintReach(player,object){
  const shape=footprints.get(object);if(!shape)return null;const centreDistance=Math.hypot(player.x-object.x,player.z-object.z);if(centreDistance>shape.reach+GATHER_RANGE)return centreDistance;const ground=shape.ground(player),p=shape.local(player);
  return Math.min(...withinHeight(shape.boxes,ground,ground+2.95/shape.scale).map(box=>distance(p,box)))*shape.scale+GATHER_RANGE-1.2;
}
export function footprintIntersectsBuilding(object,building){
  const shape=footprints.get(object);if(!shape)return null;
  const ground=shape.ground(building),height={campfire:1.8,tent:3,workbench:2.2}[building.type],radius=building.type==='tent'?2.15:building.type==='campfire'?1.45:1.5,p=shape.local(building);
  if(Math.hypot(building.x-object.x,building.z-object.z)>shape.reach+radius)return false;
  return withinHeight(shape.boxes,ground,ground+height/shape.scale).some(box=>distance(p,box)*shape.scale<radius);
}
