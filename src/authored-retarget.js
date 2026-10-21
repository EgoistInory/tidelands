import * as THREE from '../vendor/three.module.min.js';

// Capture while the library and target are still in their actual imported bind poses.
export function captureAuthorRest(root){
  const rest=new Map();root.traverse(o=>{if(o.isBone)rest.set(o.name,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});});return rest;
}
export function retargetAuthoredClips(target,reference,clips,bodyRatio=1){
  const rest=captureAuthorRest(target);
  return clips.map(clip=>{
    const output=clip.clone();
    for(const track of output.tracks){
      const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),property=track.name.slice(dot+1),from=reference.get(name),to=rest.get(name);
      if(!from||!to)throw Error('Missing author/target bone '+name);
      if(property==='position'){
        const ratio=name==='root'||name==='pelvis'||from.position.length()<1e-6?bodyRatio:to.position.length()/from.position.length();
        for(let i=0;i<track.values.length;i+=3){const p=new THREE.Vector3().fromArray(track.values,i).sub(from.position).multiplyScalar(ratio).add(to.position);p.toArray(track.values,i);}
      }else if(property==='quaternion'){
        const correction=to.quaternion.clone().multiply(from.quaternion.clone().invert());
        for(let i=0;i<track.values.length;i+=4){const q=new THREE.Quaternion().fromArray(track.values,i).premultiply(correction).normalize();q.toArray(track.values,i);}
      }else if(property==='scale'){
        if([from.scale.x,from.scale.y,from.scale.z].some(v=>Math.abs(v)<1e-8))throw Error('Invalid author bone rest scale');
        const ratio=to.scale.clone().divide(from.scale);
        for(let i=0;i<track.values.length;i+=3)new THREE.Vector3().fromArray(track.values,i).multiply(ratio).toArray(track.values,i);
      }else throw Error('Unsupported author bone property '+property);
    }
    return output;
  });
}
