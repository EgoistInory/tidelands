import * as THREE from '../vendor/three.module.min.js';

// Geometry scales spherical UVs by radius; these repeats approximate the source's 2m tile.
const repeat=new THREE.Vector2(Math.PI,Math.PI/2);
export function createRockSurface({loader,anisotropy=1}={}){
  const ready={value:0},enabled={value:1},state={status:'unloaded',loaded:0,failed:[]};
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.93});
  let finish;
  const loaded=new Promise(resolve=>{finish=resolve;});
  const load=(textureLoader,maxAnisotropy)=>{
    if(state.status!=='unloaded')return loaded;
    state.status='loading';let completed=0;
    const complete=(file,error=false)=>{
      completed++;
      if(error){state.failed.push(file);state.status='fallback';if(state.failed.length===1)console.warn('石料贴图加载失败，保留原表面。');}else state.loaded++;
      if(completed===3){state.status=state.failed.length?'fallback':'ready';ready.value=state.failed.length?0:1;finish(state);}
    };
    const texture=(file,colorSpace)=>{
      const map=textureLoader.load(new URL(`../assets/rock/lichen-rock/${file}`,import.meta.url).href,()=>complete(file),undefined,()=>complete(file,true));
      map.colorSpace=colorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.copy(repeat);
      map.anisotropy=Math.max(1,Math.min(4,maxAnisotropy));map.generateMipmaps=true;
      map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.updateMatrix();return map;
    };
    const albedo=texture('albedo.jpg',THREE.SRGBColorSpace);
    material.normalMap=texture('normal-gl.jpg',THREE.NoColorSpace);material.normalScale.set(.65,.65);
    material.roughnessMap=texture('roughness.jpg',THREE.NoColorSpace);
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{rockAlbedo:{value:albedo},rockReady:ready,rockEnabled:enabled,rockRepeat:{value:repeat}});
      shader.vertexShader='varying vec2 rockUV;uniform vec2 rockRepeat;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrockUV=uv*rockRepeat;');
      shader.fragmentShader='varying vec2 rockUV;uniform sampler2D rockAlbedo;uniform float rockReady;uniform float rockEnabled;\n'+shader.fragmentShader
        .replace('#include <color_fragment>',`#include <color_fragment>
          float rockBlend=rockReady*rockEnabled;
          diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(rockAlbedo,rockUV).rgb,rockBlend);`)
        .replace('#include <roughnessmap_fragment>',THREE.ShaderChunk.roughnessmap_fragment.replace('roughnessFactor *= texelRoughness.g;','roughnessFactor *= mix(1.,texelRoughness.g,rockBlend);'))
        .replace('#include <normal_fragment_maps>',`
          vec3 rockNormal=texture2D(normalMap,vNormalMapUv).xyz*2.-1.;
          rockNormal.xy*=normalScale;
          normal=normalize(mix(normal,normalize(tbn*rockNormal),rockBlend));`);
    };
    material.customProgramCacheKey=()=> 'tidelands-rock-cc0-v1';material.needsUpdate=true;
    return loaded;
  };
  material.userData.rock={state,loaded,load,enabled};
  if(loader)load(loader,anisotropy);
  return material;
}
