// Exact numerical attributes only: no rounding, face reversal or seam removal.
export function deduplicateSurface(attributes,indices){
 const widths={POSITION:3,NORMAL:3,TEXCOORD_0:2},count=attributes.POSITION?.length/3;
 if(!Number.isInteger(count)||!count||!(indices instanceof Uint32Array)||indices.length%3)throw Error('Invalid surface');
 for(const [key,width]of Object.entries(widths))if(!(attributes[key] instanceof Float32Array)||attributes[key].length!==count*width||!attributes[key].every(Number.isFinite))throw Error('Invalid surface attributes');
 const vertices=new Map(),remap=new Uint32Array(count),kept=[];
 for(let i=0;i<count;i++){
  const key=Object.entries(widths).flatMap(([name,width])=>Array.from(attributes[name].subarray(i*width,i*width+width))).join(',');
  if(!vertices.has(key)){vertices.set(key,vertices.size);kept.push(i);}remap[i]=vertices.get(key);
 }
 const faces=new Set(),output=[];let removedFaces=0;
 for(let i=0;i<indices.length;i+=3){
  const ids=[0,1,2].map(j=>{const index=indices[i+j];if(index>=count)throw Error('Index outside surface');return remap[index];});
  const first=ids.indexOf(Math.min(...ids)),key=[ids[first],ids[(first+1)%3],ids[(first+2)%3]].join(',');
  if(faces.has(key)){removedFaces++;continue;}faces.add(key);output.push(...ids);
 }
 const result={};for(const [name,width]of Object.entries(widths)){const array=new Float32Array(kept.length*width);kept.forEach((source,index)=>array.set(attributes[name].subarray(source*width,source*width+width),index*width));result[name]=array;}
 return {attributes:result,indices:new Uint32Array(output),removedFaces,removedVertices:count-kept.length};
}
