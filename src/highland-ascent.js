// The worn ascent follows the existing safe grade from the shore to the lookout.
export const HIGHLAND_ASCENT = [
  [-79,-151],[-82,-158],[-82,-166],[-79,-173],[-76,-180],[-72,-185],[-70,-190]
];

const smooth=(a,b,value)=>{
  const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
  return t*t*(3-2*t);
};

export function highlandAscent(x,z,height,slope=0){
  if(x< -104||x> -48||z< -205||z> -143||height<1.2)return null;
  let distance=Infinity;
  for(let i=1;i<HIGHLAND_ASCENT.length;i++){
    const [ax,az]=HIGHLAND_ASCENT[i-1],[bx,bz]=HIGHLAND_ASCENT[i],dx=bx-ax,dz=bz-az;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,z-az-t*dz));
  }
  const verge=(1-smooth(12,18,distance))*smooth(1.2,3,height)*
    smooth(-205,-197,z)*(1-smooth(-151,-143,z));
  if(verge===0)return null;
  const rockBands=.5+.5*Math.sin(z*.52+x*.19+1.4*Math.sin(x*.26));
  const scatteredEdge=.42*Math.sin(x*1.2+z*.75)+.26*Math.cos(x*.75-z*1.1);
  const wear=verge*(1-smooth(1.1,3.8,distance+scatteredEdge));
  const [lookoutX,lookoutZ]=HIGHLAND_ASCENT.at(-1);
  const flanks=verge*smooth(2.3,4.8,distance)*smooth(4,9,Math.hypot(x-lookoutX,z-lookoutZ));
  const stone=flanks*smooth(.35,.89,slope*.72+rockBands*.39);
  const plants=flanks*(1-smooth(.61,.85,slope))*(.28+.72*(1-smooth(.26,.76,rockBands)));
  // Expose broad seams along the existing relief on either side of the trail.
  // The layers use terrain material weights, leaving the walking surface intact.
  const bed=height*.19+(x+76)*.021+.18*Math.sin((z+170)*.14);
  const layer=bed-Math.floor(bed);
  const outcrop=verge*smooth(3.8,7,distance)*smooth(.08,.26,layer)*(1-smooth(.66,.91,layer))*
    (.8+.2*smooth(.2,.65,slope));
  return {wear,stone,plants,outcrop};
}
