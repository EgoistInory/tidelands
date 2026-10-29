import * as THREE from '../vendor/three.module.min.js';import {terrain} from '../src/world.js';
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
function noise(x,z){const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);}
export function landformSample(x,z){
 const y=terrain(x,z),dry=smooth(1.6,5.8,y);if(!dry)return [0,0,0];
 const heights=[terrain(x+8,z),terrain(x-8,z),terrain(x,z+8),terrain(x,z-8)],curvature=y-heights.reduce((a,b)=>a+b,0)/4,slope=Math.hypot(heights[0]-heights[1],heights[2]-heights[3])/16;
 return [(noise(x/22,z/22)*.65+noise(x/67,z/67)*.35)*dry,smooth(.03,.9,curvature)*dry,smooth(.08,.6,-curvature)*(1-smooth(.25,.75,slope))*dry];
}
export function createLandformSurfaceCandidate(base,geometry){
 const start=performance.now(),p=geometry.attributes.position,values=new Float32Array(p.count*3),previous=geometry.getAttribute('landformLayers');
 for(let i=0;i<p.count;i++)values.set(landformSample(p.getX(i),p.getZ(i)),i*3);
 geometry.setAttribute('landformLayers',new THREE.BufferAttribute(values,3));const material=base.clone();material.defines={...base.defines};
 material.onBeforeCompile=shader=>{
  base.onBeforeCompile(shader);
  shader.vertexShader='attribute vec3 landformLayers;varying vec3 landformWeatherLayers;varying float landformElevation;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlandformWeatherLayers=landformLayers;landformElevation=position.y;');
  shader.fragmentShader='varying vec3 landformWeatherLayers;varying float landformElevation;\n'+shader.fragmentShader;
  const macro=`
   float landformWeather=landformWeatherLayers.x;
   vec3 landformTint=mix(vec3(.63,.73,.77),vec3(1.16,1.13,1.04),landformWeather);
   landformTint=mix(landformTint,vec3(1.12,1.13,1.09),landformWeatherLayers.y*.6);
   landformTint*=1.-landformWeatherLayers.z*.2;
   diffuseColor.rgb*=mix(vec3(1.),landformTint,smoothstep(1.6,5.8,landformElevation));`;
  const end='diffuseColor.rgb*=mix(1.,.64,shoreWetness);';
  shader.fragmentShader=shader.fragmentShader.replace(shader.fragmentShader.includes(end)?end:'#include <color_fragment>',m=>m+macro);
  shader.fragmentShader=shader.fragmentShader.replace('vec2 rockX=groundPosition.zy*.33,rockY=groundPosition.xz*.33,rockZ=groundPosition.xy*.33;',`vec2 rockX=groundPosition.zy*.33,rockY=groundPosition.xz*.33,rockZ=groundPosition.xy*.33;
   rockX+=vec2(landformWeatherLayers.x*1.37,landformWeatherLayers.y*.73+landformWeatherLayers.z*.43);
   rockY+=vec2(landformWeatherLayers.x*1.11,landformWeatherLayers.z*.83);
   rockZ+=vec2(landformWeatherLayers.y*.73,landformWeatherLayers.x*1.37);`);
 };
 material.customProgramCacheKey=()=>base.customProgramCacheKey()+'-landform-surface-candidate-v1';
 return {material,attributeBytes:values.byteLength,buildCpuMs:performance.now()-start,release(){material.dispose();if(previous)geometry.setAttribute('landformLayers',previous);else geometry.deleteAttribute('landformLayers');}};
}
