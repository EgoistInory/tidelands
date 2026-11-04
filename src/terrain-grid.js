import {visibleGroundSampler} from './ground-support.js';

export const TERRAIN_SIZE=800,TERRAIN_SEGMENTS=320;
// The static authority and rendered plane read the same rounded vertices and diagonal.
export function createTerrainSurface(rawHeight){
 const stride=TERRAIN_SEGMENTS+1,step=TERRAIN_SIZE/TERRAIN_SEGMENTS,half=TERRAIN_SIZE/2,cache=new Float32Array(stride*stride);cache.fill(NaN);
 const position={count:cache.length,getX:()=>-half,getZ:()=>-half,getY(index){
  if(Number.isNaN(cache[index])){const value=rawHeight(-half+(index%stride)*step,-half+Math.floor(index/stride)*step);if(!Number.isFinite(value))throw Error('Non-finite static terrain vertex');cache[index]=value;}
  return cache[index];
 }};
 const sample=visibleGroundSampler({parameters:{width:TERRAIN_SIZE,height:TERRAIN_SIZE,widthSegments:TERRAIN_SEGMENTS,heightSegments:TERRAIN_SEGMENTS},attributes:{position}});
 return (x,z)=>sample(x,z)??rawHeight(x,z);
}
export function terrainStepAllowed(from,to,heightAt){
 const rise=heightAt(to.x,to.z)-heightAt(from.x,from.z),distance=Math.hypot(to.x-from.x,to.z-from.z);
 // Small input timesteps must not turn a cliff into a staircase; downhill escape stays available.
 return rise<=1.9&&rise<=distance*1.25+.02;
}
