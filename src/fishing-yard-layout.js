// One fixed settlement kit: the renderer, body, camera and placement rules share this plan.
import {terrain} from './world.js';
export function fishingYardLayout(anchor={x:-33,z:77},heightAt=terrain){
 const base=heightAt(anchor.x,anchor.z),local=(x,z)=>heightAt(anchor.x+x,anchor.z+z)-base,boxes=[];
 const box=(w,h,d,x,y,z)=>boxes.push([[anchor.x+x-w/2-.035,base+y-h/2-.035,anchor.z+z-d/2-.035],[anchor.x+x+w/2+.035,base+y+h/2+.035,anchor.z+z+d/2+.035]]);
 const sill=Math.max(...[-3.2,3.2].flatMap(x=>[-1.3,1.3].map(z=>local(x,z))))+.65;
 for(const x of [-2.3,2.3]){box(.3,.24,3,x,sill,0);for(const z of [-1.15,1.15]){const y=local(x,z),top=sill-.1;box(.19,top-y,.19,x,(y+top)/2,z);}}
 box(7.6,1,2.72,0,sill+.62,0);box(7.71,.62,.11,0,sill+.88,0);
 const beam=Math.max(local(-3.3,-3),local(3.3,-3))+3.4;
 for(const x of [-3.3,3.3]){const y=local(x,-3);box(.21,beam-y,.21,x,(beam+y)/2,-3);}
 box(7,.18,.22,0,beam,-3);box(6.4,2.68,.16,0,beam-1.39,-3);
 for(const [x,z,s]of [[4.6,.4,1.05],[4.8,1.65,.8],[4.6,.4,.75]])box(s,s,s,x,local(x,z)+(s===.75?1.05:0)+s/2,z);
 const bounds=[[Math.min(...boxes.map(b=>b[0][0])),Math.min(...boxes.map(b=>b[0][2]))],[Math.max(...boxes.map(b=>b[1][0])),Math.max(...boxes.map(b=>b[1][2]))]];
 return {anchor:{...anchor,y:base},sill,beam,boxes,bounds,clearance:[(bounds[0][0]+bounds[1][0])/2,(bounds[0][1]+bounds[1][1])/2,(bounds[1][0]-bounds[0][0])/2+.4,(bounds[1][1]-bounds[0][1])/2+.4]};
}
export const FISHING_YARD=fishingYardLayout();
const sizes={campfire:[1.6,1.6,2.15,-.05],tent:[2.15,1.85,3,-.001],workbench:[1.65,1.2,2.2,0]};
export function fishingYardIntersectsBuilding(b){
 const [w,d,h,bottom]=sizes[b.type]??[0,0,0,0],y=terrain(b.x,b.z);
 return FISHING_YARD.boxes.some(([lo,hi])=>b.x+w>lo[0]&&b.x-w<hi[0]&&b.z+d>lo[2]&&b.z-d<hi[2]&&y+h>lo[1]&&y+bottom<hi[1]);
}
const restores=new WeakMap();
export function fishingYardActive(state){
 if(!restores.has(state)){
  const inside=p=>p&&FISHING_YARD.boxes.some(([lo,hi])=>p.x+.3499>lo[0]&&p.x-.3499<hi[0]&&p.z+.3499>lo[2]&&p.z-.3499<hi[2]&&terrain(p.x,p.z)+2.95>lo[1]&&terrain(p.x,p.z)<hi[1]);
  // Save restore gets one stable decision; ordinary approach must never disable collision.
  restores.set(state,!(state.buildings.some(fishingYardIntersectsBuilding)||inside(state.player)||inside(state.respawn)));
 }return restores.get(state);
}
export function fishingYardBlocksMove(state,from,to,radius=.35,height=2.95){
 const [[minX,minZ],[maxX,maxZ]]=FISHING_YARD.bounds;
 if(Math.max(from.x,to.x)+radius<minX||Math.min(from.x,to.x)-radius>maxX||Math.max(from.z,to.z)+radius<minZ||Math.min(from.z,to.z)-radius>maxZ||!fishingYardActive(state))return false;
 const y0=terrain(from.x,from.z),y1=terrain(to.x,to.z),dx=to.x-from.x,dz=to.z-from.z;
 for(const [lo,hi]of FISHING_YARD.boxes){
  if(hi[1]<=Math.min(y0,y1)+.02||lo[1]>=Math.max(y0,y1)+height)continue;
  if(from.x>lo[0]-radius&&from.x<hi[0]+radius&&from.z>lo[2]-radius&&from.z<hi[2]+radius){
   if((from.x-(lo[0]+hi[0])/2)*dx+(from.z-(lo[2]+hi[2])/2)*dz< -1e-10)return true;continue;
  }
  let enter=0,leave=1;
  for(const [a,b,l,h]of [[from.x,to.x,lo[0]-radius,hi[0]+radius],[from.z,to.z,lo[2]-radius,hi[2]+radius]]){
   const delta=b-a;if(Math.abs(delta)<1e-12){if(a<=l||a>=h){leave=-1;break;}continue;}
   const u=(l-a)/delta,v=(h-a)/delta;enter=Math.max(enter,Math.min(u,v));leave=Math.min(leave,Math.max(u,v));
  }
  if(enter<leave&&enter<1&&leave>0)return true;
 }return false;
}
