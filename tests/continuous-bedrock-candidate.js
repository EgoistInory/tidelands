// The surface itself owns these ledges; no independent rock dressing or resource relocation.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function continuousBedrockHeight(x,z,base,islands,protectedSites){
 const highland=islands[2],distance=Math.hypot(x-highland.x,z-highland.z)/highland.r;
 if(distance>=.92||base<=12)return base;
 let weight=(1-smooth(.64,.92,distance))*smooth(12,21,base);
 for(const p of protectedSites)weight*=smooth(12,25,Math.hypot(x-p.x,z-p.z));
 if(weight===0)return base;
 const warp=Math.sin(x*.07+Math.cos(z*.05))*.9+Math.sin(z*.08)*.7+(x-highland.x)*.08;
 const q=(base+warp)/8,level=Math.floor(q),phase=q-level;
 const ledge=(level+smooth(.38,.64,phase))*8-warp;
 return base+(ledge-base)*weight;
}
