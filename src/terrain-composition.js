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
  // Regional macroforms keep the islands from reading as the same rotated hill:
  // low dunes on the coast/shoal, folded forest ridges, and a sharper highland spine.
  const [angle,frequency,warp,width,amplitude,shoulder,shoulderWidth,valley,valleyAt,valleyWidth,secondary]=[
    [.45,4.2,.08,.17,7.5,.31,.15,-.48,.02,.16,0],
    [-.6,5.4,.13,.12,13.5,.30,.12,-.62,.01,.13,.32],
    [.2,5.4,.12,.135,9,.34,.14,-.82,.015,.14,.34],
    [.8,3.8,.06,.20,5.5,.29,.19,-.72,.02,.21,0]
  ][region];
  const a=u*Math.cos(angle)+v*Math.sin(angle),b=-u*Math.sin(angle)+v*Math.cos(angle);
  const band=(center,width)=>Math.exp(-(((b-center)/width)**2));
  const ridgeCenter=-.22-warp*Math.sin(a*frequency),shoulderCenter=shoulder-warp*.72*Math.sin(a*(frequency-.8)+1);
  const ridge=band(ridgeCenter,width)*(.72+.28*Math.cos(a*(frequency-.9)));
  const folded=secondary*band(.08+warp*.55*Math.sin(a*frequency*.73+2),width*.82);
  const shoulderLift=.65*band(shoulderCenter,shoulderWidth);
  const gully=valley*band(valleyAt,valleyWidth);
  return amplitude*weight*(ridge+folded+shoulderLift+gully);
}
