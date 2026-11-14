// A small authored desire-line network; no terrain, collision or resource placement changes.
export const SETTLEMENT_PATH=[[-70,108],[-70,102],[-59,94],[-46,86]];
const clearings=[[-70,108,3.3],[-59,94,1.8],[-46,86,2.1]];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function settlementWearAt(x,z){
 if(x< -80||x> -37||z<78||z>117)return 0;
 let wear=0;
 for(let i=1;i<SETTLEMENT_PATH.length;i++){
  const [ax,az]=SETTLEMENT_PATH[i-1],[bx,bz]=SETTLEMENT_PATH[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
  wear=Math.max(wear,1-smooth(.65,1.65,Math.hypot(x-ax-dx*t,z-az-dz*t)));
 }
 for(const [cx,cz,r]of clearings)wear=Math.max(wear,1-smooth(r-.7,r+.7,Math.hypot(x-cx,z-cz)));
 return wear;
}
const vec=([x,z])=>`vec2(${x.toFixed(1)},${z.toFixed(1)})`;
export const settlementGroundGLSL=`
 float settlementHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float settlementGrain(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(settlementHash(i),settlementHash(i+vec2(1,0)),f.x),mix(settlementHash(i+vec2(0,1)),settlementHash(i+vec2(1,1)),f.x),f.y);}
 float settlementSegment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;float t=clamp(dot(p-a,d)/dot(d,d),0.,1.);return 1.-smoothstep(.65,1.65,length(p-a-t*d));}
 float settlementWear(vec2 p){
  if(p.x< -80.||p.x> -37.||p.y<78.||p.y>117.)return 0.;
  float w=0.;
  ${SETTLEMENT_PATH.slice(1).map((b,i)=>`w=max(w,settlementSegment(p,${vec(SETTLEMENT_PATH[i])},${vec(b)}));`).join('\n')}
  ${clearings.map(([x,z,r])=>`w=max(w,1.-smoothstep(${(r-.7).toFixed(2)},${(r+.7).toFixed(2)},length(p-${vec([x,z])})));`).join('\n')}
  return w;
 }
`;
