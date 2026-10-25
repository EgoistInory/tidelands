// Broad landforms retain the original layout field and protected quest working areas.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function landformOffset(x,z,base,islands,protectedSites){
  if(base<=4)return 0;
  let region=0,distance=Infinity;
  islands.forEach((o,i)=>{const d=Math.hypot(x-o.x,z-o.z)/o.r;if(d<distance){distance=d;region=i;}});
  if(distance>=.92)return 0;
  let weight=smooth(.08,.6,1-distance)*smooth(4,9,base);
  for(const site of protectedSites){
    const radius=site.id?18:35;
    weight*=smooth(radius,radius+18,Math.hypot(x-site.x,z-site.z));
  }
  if(weight===0)return 0;
  const island=islands[region],u=(x-island.x)/island.r,v=(z-island.z)/island.r;
  const angle=[.45,-.6,.2,.8][region],a=u*Math.cos(angle)+v*Math.sin(angle),b=-u*Math.sin(angle)+v*Math.cos(angle);
  const band=(center,width)=>Math.exp(-(((b-center)/width)**2));
  const ridge=band(-.22-.1*Math.sin(a*5),.13)*(.7+.3*Math.cos(a*4));
  const shoulder=.65*band(.28-.1*Math.sin(a*4+1),.1);
  const gully=-.8*band(.015,.115);
  return [9,12,8,5][region]*weight*(ridge+shoulder+gully);
}
