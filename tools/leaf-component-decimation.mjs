// Offline only. Each connected source leaf survives as a source-vertex mesh.
import {Triangle,Vector3} from '../vendor/three.module.min.js';
export function simplifyLeafComponent(simplifier,attributes,indices,level){
 const config={near:{ratio:.35,error:.004,sample:.009},mid:{ratio:.15,error:.012,sample:.02}}[level],widths={POSITION:3,NORMAL:3,TEXCOORD_0:2},count=attributes.POSITION?.length/3;
 if(!config||!Number.isInteger(count)||count<3||!(indices instanceof Uint32Array)||indices.length<3||indices.length%3)throw Error('Invalid leaf component');
 for(const [key,width]of Object.entries(widths))if(!(attributes[key] instanceof Float32Array)||attributes[key].length!==count*width||!attributes[key].every(Number.isFinite))throw Error('Invalid component attributes');
 if(!indices.every(i=>i<count))throw Error('Component index outside source');
 const fallback=reason=>({attributes,indices,fallbackReason:reason,maxSourceSampleError:0,simplifierError:0,sourceSamples:0});
 if(indices.length<=6)return fallback('already-minimal');
 const weights=new Float32Array(count*5),locks=new Uint8Array(count),uv=attributes.TEXCOORD_0;
 for(let i=0;i<count;i++){weights.set(attributes.NORMAL.subarray(i*3,i*3+3),i*5);weights.set(uv.subarray(i*2,i*2+2),i*5+3);}
 for(const axis of [0,1])for(const sign of [-1,1]){let best=0;for(let i=1;i<count;i++)if(sign*uv[i*2+axis]>sign*uv[best*2+axis])best=i;locks[best]=1;}
 const [candidate,error]=simplifier.simplifyWithAttributes(indices,attributes.POSITION,3,weights,5,[.2,.2,.2,.1,.1],locks,Math.max(6,Math.floor(indices.length*config.ratio/3)*3),config.error,['ErrorAbsolute']);
 if(!(candidate instanceof Uint32Array)||candidate.length<6||candidate.length%3||!candidate.every(i=>i<count)||!Number.isFinite(error)||error>config.error+1e-6)return fallback('invalid-or-deleted-component');
 const parents=new Map();for(const i of candidate)parents.set(i,i);const find=i=>{while(parents.get(i)!==i){parents.set(i,parents.get(parents.get(i)));i=parents.get(i);}return i;};
 for(let i=0;i<candidate.length;i+=3){const a=find(candidate[i]);parents.set(find(candidate[i+1]),a);parents.set(find(candidate[i+2]),a);}if(new Set([...parents.keys()].map(find)).size!==1)return fallback('split-component');
 for(const axis of [0,1]){
  let oldMin=Infinity,oldMax=-Infinity,newMin=Infinity,newMax=-Infinity;
  for(const i of indices){oldMin=Math.min(oldMin,uv[i*2+axis]);oldMax=Math.max(oldMax,uv[i*2+axis]);}for(const i of candidate){newMin=Math.min(newMin,uv[i*2+axis]);newMax=Math.max(newMax,uv[i*2+axis]);}
  if(Math.abs(oldMin-newMin)>1e-7||Math.abs(oldMax-newMax)>1e-7)return fallback('lost-uv-extent');
 }
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),point=new Vector3(),closest=new Vector3(),triangle=new Triangle(a,b,c),positions=attributes.POSITION;let maxSourceSampleError=0,sourceSamples=0;
 const measure=()=>{let min=Infinity;for(let i=0;i<candidate.length;i+=3){a.fromArray(positions,candidate[i]*3);b.fromArray(positions,candidate[i+1]*3);c.fromArray(positions,candidate[i+2]*3);triangle.closestPointToPoint(point,closest);min=Math.min(min,point.distanceToSquared(closest));}sourceSamples++;maxSourceSampleError=Math.max(maxSourceSampleError,Math.sqrt(min));return maxSourceSampleError<=config.sample;};
 for(let i=0;i<count;i++){point.fromArray(positions,i*3);if(!measure())return fallback('source-sample-deviation');}
 for(let i=0;i<indices.length;i+=3){point.set(0,0,0);for(let j=0;j<3;j++)for(let axis=0;axis<3;axis++)point.setComponent(axis,point.getComponent(axis)+positions[indices[i+j]*3+axis]/3);if(!measure())return fallback('source-sample-deviation');}
 const remap=new Map(),used=[];for(const i of candidate)if(!remap.has(i)){remap.set(i,used.length);used.push(i);}
 const compacted={};for(const [key,width]of Object.entries(widths)){const array=new Float32Array(used.length*width);used.forEach((i,j)=>array.set(attributes[key].subarray(i*width,i*width+width),j*width));compacted[key]=array;}
 return {attributes:compacted,indices:new Uint32Array(Array.from(candidate,i=>remap.get(i))),fallbackReason:null,maxSourceSampleError,simplifierError:error,sourceSamples};
}
