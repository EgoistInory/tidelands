import {visibleGroundSampler} from '../src/ground-support.js';

// Static candidate heights share the production plane's rounded vertices and diagonal.
export function createConformingBedrock(rawHeight){
 const segments=320,stride=segments+1,step=800/segments,cache=new Float32Array(stride*stride);cache.fill(NaN);
 const position={count:cache.length,getX:()=>-400,getZ:()=>-400,getY(index){
  if(Number.isNaN(cache[index])){
   const value=rawHeight(-400+(index%stride)*step,-400+Math.floor(index/stride)*step);
   if(!Number.isFinite(value))throw Error('Non-finite static terrain vertex');cache[index]=value;
  }
  return cache[index];
 }};
 const sample=visibleGroundSampler({parameters:{width:800,height:800,widthSegments:segments,heightSegments:segments},attributes:{position}});
 return (x,z)=>sample(x,z)??rawHeight(x,z);
}
