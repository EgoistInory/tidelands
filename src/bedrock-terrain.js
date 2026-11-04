const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function segmentDistance(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);}
export function bedrockHeight(x,z,base,islands,sites){
 const highland=islands[2],distance=Math.hypot(x-highland.x,z-highland.z)/highland.r;if(distance>=.92||base<=12)return base;
 let weight=(1-smooth(.64,.92,distance))*smooth(12,21,base);
 // Include neighbouring grid corners so the full 12m working area keeps its accepted surface.
 for(const p of sites)weight*=smooth(18,30,Math.hypot(x-p.x,z-p.z));
 // Connected natural ramps remain between the quest approach, ridge and ruin.
 const explorer=sites.find(p=>p.id==='explorer'),ruin=sites.find(p=>p.id==='ruin');
 if(explorer&&ruin)weight*=smooth(4,9,Math.min(segmentDistance(x,z,explorer,highland),segmentDistance(x,z,highland,ruin)));
 if(weight===0)return base;
 const warp=Math.sin(x*.07+Math.cos(z*.05))*.9+Math.sin(z*.08)*.7+(x-highland.x)*.08,q=(base+warp)/8,level=Math.floor(q),phase=q-level;
 return base+((level+smooth(.38,.64,phase))*8-warp-base)*weight;
}
