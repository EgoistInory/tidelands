// QA-only reversible foreground visibility; no map clones, shadow changes or extra render passes.
import * as T from '../vendor/three.module.min.js';
const uniforms={cameraOcclusionFocus:{value:new T.Vector3()},cameraOcclusionLens:{value:new T.Vector3()},cameraOcclusionAmount:{value:0}},prepared=new WeakSet(),roots=new WeakSet();
function materialHook(material){
 if(!material||prepared.has(material)||material.transparent||!(material.isMeshStandardMaterial||material.isMeshBasicMaterial||material.isMeshPhongMaterial))return;
 const before=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  before.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 cameraOcclusionWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`
   vec4 cameraOcclusionPoint=vec4(transformed,1.0);
   #ifdef USE_BATCHING
    cameraOcclusionPoint=batchingMatrix*cameraOcclusionPoint;
   #endif
   #ifdef USE_INSTANCING
    cameraOcclusionPoint=instanceMatrix*cameraOcclusionPoint;
   #endif
   cameraOcclusionWorld=(modelMatrix*cameraOcclusionPoint).xyz;
   #include <project_vertex>`);
  shader.fragmentShader='varying vec3 cameraOcclusionWorld;uniform vec3 cameraOcclusionFocus,cameraOcclusionLens;uniform float cameraOcclusionAmount;\n'+shader.fragmentShader.replace('#include <dithering_fragment>',`
   vec3 cameraOcclusionLine=cameraOcclusionLens-cameraOcclusionFocus;
   float cameraOcclusionT=dot(cameraOcclusionWorld-cameraOcclusionFocus,cameraOcclusionLine)/max(dot(cameraOcclusionLine,cameraOcclusionLine),.0001);
   float cameraOcclusionRadius=mix(1.6,.45,clamp(cameraOcclusionT,0.,1.));
   float cameraOcclusionDistance=length(cameraOcclusionWorld-(cameraOcclusionFocus+cameraOcclusionLine*clamp(cameraOcclusionT,0.,1.)));
   float cameraOcclusionCoverage=(1.-smoothstep(cameraOcclusionRadius*.65,cameraOcclusionRadius,cameraOcclusionDistance))*step(.025,cameraOcclusionT)*(1.-step(.98,cameraOcclusionT))*cameraOcclusionAmount*.96;
   float cameraOcclusionNoise=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
   if(cameraOcclusionNoise<cameraOcclusionCoverage)discard;
   #include <dithering_fragment>`);
 };
 material.customProgramCacheKey=()=>key+':camera-occlusion-v1';material.needsUpdate=true;prepared.add(material);
}
export function prepareCameraOccluder(root){
 if(!root)return;if(root.isMesh){for(const m of Array.isArray(root.material)?root.material:[root.material])materialHook(m);}
 if(roots.has(root))return;root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materialHook(m);});roots.add(root);
}
export function createForegroundFade(){
 let amount=0;
 return {get amount(){return amount;},update(focus,camera,blocked,dt){const target=blocked?1:0;amount+=(target-amount)*(1-Math.exp(-Math.max(0,Math.min(.05,dt))*(blocked?12:5)));uniforms.cameraOcclusionFocus.value.copy(focus);uniforms.cameraOcclusionLens.value.copy(camera);uniforms.cameraOcclusionAmount.value=amount;},reset(){amount=0;uniforms.cameraOcclusionAmount.value=0;}};
}
