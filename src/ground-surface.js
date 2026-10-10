import * as THREE from '../vendor/three.module.min.js';

// CC0 source and channel hashes are kept beside the local textures.
export function createGroundSurface(detail,{loader=new THREE.TextureLoader(),anisotropy=1}={}){
  const ready={value:0},enabled={value:1},state={status:'loading',loaded:0,failed:[]};
  let finish,completed=0;
  const loaded=new Promise(resolve=>{finish=resolve;});
  const complete=(channel,error=false)=>{
    completed++;
    if(error){
      state.failed.push(channel);state.status='fallback';
      if(state.failed.length===1)console.warn('草地贴图加载失败，保留原地表。');
    }else state.loaded++;
    if(completed===3){
      state.status=state.failed.length?'fallback':'ready';ready.value=state.failed.length?0:1;finish(state);
    }
  };
  const texture=(file,colorSpace)=>{
    const map=loader.load(new URL(`../assets/ground/leafy-grass/${file}`,import.meta.url).href,()=>complete(file),undefined,()=>complete(file,true));
    map.colorSpace=colorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
    // The source covers two metres; terrain UVs span the existing 800m plane.
    map.repeat.set(400,400);map.anisotropy=Math.max(1,Math.min(4,anisotropy));
    map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
    return map;
  };
  const albedo=texture('albedo.jpg',THREE.SRGBColorSpace);
  const normal=texture('normal-gl.jpg',THREE.NoColorSpace);
  const roughness=texture('roughness.jpg',THREE.NoColorSpace);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,map:detail,bumpMap:detail,bumpScale:.09,normalMap:normal,normalScale:new THREE.Vector2(.4,.4),roughnessMap:roughness,roughness:1});
  material.userData.ground={state,loaded,enabled};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{groundAlbedo:{value:albedo},groundReady:ready,groundEnabled:enabled});
    shader.vertexShader=`varying vec3 groundPosition;varying float groundSlope;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
      groundPosition=position;groundSlope=1.-normal.y;`);
    shader.fragmentShader=`uniform sampler2D groundAlbedo;uniform float groundReady;uniform float groundEnabled;
      varying vec3 groundPosition;varying float groundSlope;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>',`
        float grassBlend=groundReady*groundEnabled*smoothstep(2.5,5.5,groundPosition.y)
          *(1.-smoothstep(.035,.14,groundSlope))*(1.-smoothstep(30.,42.,groundPosition.y));
        vec4 baseDetail=texture2D(map,vMapUv);
        vec3 grassColor=texture2D(groundAlbedo,vec2(groundPosition.x,-groundPosition.z)*.5).rgb;
        diffuseColor*=baseDetail;`)
      // Three applies vertex colours after map_fragment; blend after that stage.
      .replace('#include <color_fragment>',`#include <color_fragment>
        // Keep the regional grass palette; the source's dry albedo supplies fine detail.
        float grassDetail=dot(grassColor,vec3(.2126,.7152,.0722));
        vec3 biomeGrass=diffuseColor.rgb*(.72+grassDetail*1.65);
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(grassColor,biomeGrass,.85),grassBlend);`)
      .replace('#include <roughnessmap_fragment>',THREE.ShaderChunk.roughnessmap_fragment.replace('roughnessFactor *= texelRoughness.g;','roughnessFactor *= mix(1.,texelRoughness.g,grassBlend);'))
      .replace('#include <normal_fragment_maps>',`
        vec3 baseNormal=perturbNormalArb(-vViewPosition,normal,dHdxy_fwd(),faceDirection);
        vec3 grassNormal=texture2D(normalMap,vNormalMapUv).xyz*2.-1.;
        grassNormal.xy*=normalScale;
        normal=normalize(mix(baseNormal,normalize(tbn*grassNormal),grassBlend));`);
  };
  material.customProgramCacheKey=()=> 'tidelands-ground-cc0-v2';
  return material;
}
