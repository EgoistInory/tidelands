// Embed the regional scan in its slope; expose its downhill face rather than perch a pillar.
import {terrain} from '../src/world.js';
import {createScannedEscarpmentCandidate} from './escarpment-scanned-candidate.js';
export function createEmbeddedEscarpmentCandidate(view){
 const result=createScannedEscarpmentCandidate(view);
 for(const mesh of result.meshes){
  const p=mesh.userData.placement,c=Math.cos(p.rotation),s=Math.sin(p.rotation),heights=Array.from({length:24},(_,i)=>{const t=i/24*Math.PI*2,x=Math.cos(t)*p.length,z=Math.sin(t)*p.width;return terrain(p.x+c*x+s*z,p.z-s*x+c*z);});
  const base=Math.min(...heights)-.8,top=Math.max(...heights)-.35,box=mesh.geometry.boundingBox;
  mesh.position.y=base;mesh.scale.y=(top-base)/(box.max.y-box.min.y);mesh.updateMatrixWorld(true);
 }
 return result;
}
