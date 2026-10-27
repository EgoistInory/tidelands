import {footprintReach} from './resource-footprint.js';
import {GATHER_RANGE} from './action-timing.js';

// Match the conservative mineral boxes used by the camera; unscaled logical nodes keep their old reach.
export function resourceHalfSize(object){
  if(!Number.isFinite(object.scale)||object.scale<=0)return 0;
  return object.type==='stone'?2.8*object.scale:object.type==='crystal'?1.5*object.scale:0;
}
export function resourceReachDistance(player,object){
  const shaped=footprintReach(player,object);if(shaped!==null)return shaped;
  const r=resourceHalfSize(object),dx=Math.abs(player.x-object.x),dz=Math.abs(player.z-object.z);
  return r?Math.hypot(Math.max(0,dx-r),Math.max(0,dz-r))+GATHER_RANGE-1.2:Math.hypot(dx,dz);
}
export function resourceBlocksMove(from,to,object,margin=.35){
  const half=resourceHalfSize(object);if(!half)return false;
  const r=half+margin,minX=object.x-r,maxX=object.x+r,minZ=object.z-r,maxZ=object.z+r;
  if(from.x>minX&&from.x<maxX&&from.z>minZ&&from.z<maxZ){
    // Old saves may be inside scenery. Permit outward escape without moving them during restore.
    return Math.hypot(to.x-object.x,to.z-object.z)<Math.hypot(from.x-object.x,from.z-object.z)-1e-10;
  }
  let enter=0,leave=1;
  for(const [start,end,min,max] of [[from.x,to.x,minX,maxX],[from.z,to.z,minZ,maxZ]]){
    const delta=end-start;
    if(Math.abs(delta)<1e-12){if(start<=min||start>=max)return false;continue;}
    const a=(min-start)/delta,b=(max-start)/delta;
    enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
    if(enter>=leave)return false;
  }
  return enter<1&&leave>0;
}
