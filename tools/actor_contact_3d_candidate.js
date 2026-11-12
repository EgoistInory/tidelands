// Isolated QA candidate: swept spherical gameplay envelope on sampled terrain.
// Equal ground levels retain the existing horizontal radii. Not mesh collision.
import {actorRadius} from '../src/actor-contact.js';
export function actorBlocksMove3D(from,to,actor,heightAt,movingRadius=.35,obstacleRadius=actorRadius(actor)){
 const radius=movingRadius+obstacleRadius,base=heightAt(actor.x,actor.z);
 const point=p=>[p.x-actor.x,heightAt(p.x,p.z)-base,p.z-actor.z];
 let a=point(from);const norm=v=>v.reduce((s,x)=>s+x*x,0);
 const count=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.1));
 for(let i=1;i<=count;i++){
  const b=point({x:from.x+(to.x-from.x)*i/count,z:from.z+(to.z-from.z)*i/count}),d=b.map((v,j)=>v-a[j]),len=norm(d),dot=a.reduce((s,v,j)=>s+v*d[j],0);
  if(norm(a)<radius*radius-1e-10){if(dot< -1e-10)return true;}
  else if(len>1e-18){const t=Math.max(0,Math.min(1,-dot/len));if(norm(a.map((v,j)=>v+t*d[j]))<radius*radius-1e-10)return true;}
  a=b;
 }return false;
}
