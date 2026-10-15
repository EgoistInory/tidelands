import * as THREE from '../vendor/three.module.min.js';

// CC0 source and channel hashes are kept beside the local textures.
export function createGroundSurface(detail,{loader=new THREE.TextureLoader(),anisotropy=1,landscape=false,rockSurface}={}){
  const textures=[],sandTextures=[];
  const ready={value:0},enabled={value:1},wetness={value:1},state={status:'loading',loaded:0,failed:[]};
  const sandReady={value:0},sandEnabled={value:1},sandState={status:'loading',loaded:0,failed:[]};
  let finish,completed=0;
  const loaded=new Promise(resolve=>{finish=resolve;});
  let finishSand,sandCompleted=0;const sandLoaded=new Promise(resolve=>{finishSand=resolve;});
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
  const completeSand=(channel,error=false)=>{
    sandCompleted++;
    if(error){sandState.failed.push(channel);sandState.status='fallback';if(sandState.failed.length===1)console.warn('沙地贴图加载失败，保留原地表。');}
    else sandState.loaded++;
    if(sandCompleted===3){sandState.status=sandState.failed.length?'fallback':'ready';sandReady.value=sandState.failed.length?0:1;finishSand(sandState);}
  };
  const texture=(file,colorSpace,folder='leafy-grass',onComplete=complete,decoded=textures)=>{
    const map=loader.load(new URL(`../assets/ground/${folder}/${file}`,import.meta.url).href,()=>{decoded.push(map);onComplete(file);},undefined,()=>onComplete(file,true));
    map.colorSpace=colorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
    // The source covers two metres; terrain UVs span the existing 800m plane.
    map.repeat.set(400,400);map.anisotropy=Math.max(1,Math.min(4,anisotropy));
    map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
    return map;
  };
  const albedo=texture('albedo.jpg',THREE.SRGBColorSpace);
  const normal=texture('normal-gl.jpg',THREE.NoColorSpace);
  const roughness=texture('roughness.jpg',THREE.NoColorSpace);
  const sandAlbedo=texture('albedo.jpg',THREE.SRGBColorSpace,'coastal-sand',completeSand,sandTextures);
  const sandNormal=texture('normal-gl.jpg',THREE.NoColorSpace,'coastal-sand',completeSand,sandTextures);
  const sandRoughness=texture('roughness.jpg',THREE.NoColorSpace,'coastal-sand',completeSand,sandTextures);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,map:detail,bumpMap:detail,bumpScale:.09,normalMap:normal,normalScale:new THREE.Vector2(.4,.4),roughnessMap:roughness,roughness:1});
  material.userData.ground={state,loaded,textures,enabled,wetness,sand:{state:sandState,loaded:sandLoaded,textures:sandTextures,enabled:sandEnabled}};
  if(landscape)material.defines={GROUND_LANDSCAPE:1};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{groundAlbedo:{value:albedo},groundReady:ready,groundEnabled:enabled,groundWetness:wetness,groundSandAlbedo:{value:sandAlbedo},groundSandNormal:{value:sandNormal},groundSandRoughness:{value:sandRoughness},groundSandReady:sandReady,groundSandEnabled:sandEnabled});
    const rock=rockSurface?.userData.rock;
    Object.assign(shader.uniforms,{groundRockReady:rock?.ready??{value:0},groundRockAlbedo:{value:rock?.channels?.albedo??albedo},groundRockNormal:{value:rock?.channels?.normal??normal},groundRockRoughness:{value:rock?.channels?.roughness??roughness}});
    shader.vertexShader=`varying vec3 groundPosition;varying float groundSlope;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
      groundPosition=position;groundSlope=1.-normal.y;`);
    shader.vertexShader=`#ifdef GROUND_LANDSCAPE
      attribute vec2 groundLayers;varying vec2 landscapeLayers;varying vec3 landscapeNormal;
      #endif\n${shader.vertexShader}`.replace('groundPosition=position;',`groundPosition=position;
      #ifdef GROUND_LANDSCAPE
        landscapeLayers=groundLayers;landscapeNormal=normal;
      #endif
      `);
    shader.fragmentShader=`uniform sampler2D groundAlbedo;uniform float groundReady;uniform float groundEnabled;uniform float groundWetness;
      uniform sampler2D groundSandAlbedo,groundSandNormal,groundSandRoughness;uniform float groundSandReady,groundSandEnabled;
      uniform sampler2D groundRockAlbedo,groundRockNormal,groundRockRoughness;uniform float groundRockReady;
      #ifdef GROUND_LANDSCAPE
        varying vec2 landscapeLayers;varying vec3 landscapeNormal;
      #endif
      varying vec3 groundPosition;varying float groundSlope;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>',`
        float rockBlend=0.,litterBlend=0.;vec3 rockColor=vec3(1.),rockWeights=vec3(0.,1.,0.);
        vec2 rockX=groundPosition.zy*.33,rockY=groundPosition.xz*.33,rockZ=groundPosition.xy*.33;
        #ifdef GROUND_LANDSCAPE
          rockBlend=landscapeLayers.x*groundRockReady;litterBlend=landscapeLayers.y;
          rockWeights=pow(abs(normalize(landscapeNormal)),vec3(4.));rockWeights/=max(dot(rockWeights,vec3(1.)),.001);
          rockColor=texture2D(groundRockAlbedo,rockX).rgb*rockWeights.x+texture2D(groundRockAlbedo,rockY).rgb*rockWeights.y+texture2D(groundRockAlbedo,rockZ).rgb*rockWeights.z;
        #endif
        float grassBlend=groundReady*groundEnabled*smoothstep(2.5,5.5,groundPosition.y)
          *(1.-smoothstep(.035,.14,groundSlope))*(1.-smoothstep(30.,42.,groundPosition.y))*(1.-rockBlend);
        float shoreWetness=groundWetness*smoothstep(-.3,.1,groundPosition.y)
          *(1.-smoothstep(.45,1.6,groundPosition.y))*(1.-smoothstep(.03,.2,groundSlope));
        float sandBlend=groundSandReady*groundSandEnabled*smoothstep(-.3,.1,groundPosition.y)
          *(1.-smoothstep(2.5,5.5,groundPosition.y))*(1.-smoothstep(.035,.14,groundSlope));
        vec4 baseDetail=texture2D(map,vMapUv);
        vec3 grassColor=texture2D(groundAlbedo,vec2(groundPosition.x,-groundPosition.z)*.5).rgb;
        vec3 sandColor=texture2D(groundSandAlbedo,vec2(groundPosition.x,-groundPosition.z)*.5).rgb;
        diffuseColor*=baseDetail;`)
      // Three applies vertex colours after map_fragment; blend after that stage.
      .replace('#include <color_fragment>',`#include <color_fragment>
        // Keep the regional grass palette; the source's dry albedo supplies fine detail.
        float grassDetail=dot(grassColor,vec3(.2126,.7152,.0722));
        // Normalize the sand's measured linear mean, preserving each island's palette.
        float sandDetail=clamp(dot(sandColor,vec3(.2126,.7152,.0722))/.122,.65,1.35);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*sandDetail,sandBlend);
        vec3 biomeGrass=diffuseColor.rgb*(.72+grassDetail*1.65);
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(grassColor,biomeGrass,.85),grassBlend);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,.65,.48)*(1.+grassDetail),litterBlend);
        diffuseColor.rgb=mix(diffuseColor.rgb,rockColor*.78+diffuseColor.rgb*.22,rockBlend);
        diffuseColor.rgb*=mix(1.,.64,shoreWetness);`)
      .replace('#include <roughnessmap_fragment>',THREE.ShaderChunk.roughnessmap_fragment.replace('roughnessFactor *= texelRoughness.g;','roughnessFactor *= mix(mix(1.,texture2D(groundSandRoughness,vRoughnessMapUv).g,sandBlend),texelRoughness.g,grassBlend);')+`
        float rockRoughness=texture2D(groundRockRoughness,rockX).g*rockWeights.x+texture2D(groundRockRoughness,rockY).g*rockWeights.y+texture2D(groundRockRoughness,rockZ).g*rockWeights.z;
        roughnessFactor=mix(roughnessFactor,rockRoughness,rockBlend);
        roughnessFactor=mix(roughnessFactor,.28,shoreWetness);`)
      .replace('#include <normal_fragment_maps>',`
        vec3 baseNormal=perturbNormalArb(-vViewPosition,normal,dHdxy_fwd(),faceDirection);
        vec3 shoreNormal=texture2D(groundSandNormal,vNormalMapUv).xyz*2.-1.;
        shoreNormal.xy*=normalScale;
        baseNormal=normalize(mix(baseNormal,normalize(tbn*shoreNormal),sandBlend));
        vec3 grassNormal=texture2D(normalMap,vNormalMapUv).xyz*2.-1.;
        grassNormal.xy*=normalScale;
        normal=normalize(mix(baseNormal,normalize(tbn*grassNormal),grassBlend));
        #ifdef GROUND_LANDSCAPE
          vec3 nx=texture2D(groundRockNormal,rockX).xyz*2.-1.,ny=texture2D(groundRockNormal,rockY).xyz*2.-1.,nz=texture2D(groundRockNormal,rockZ).xyz*2.-1.;
          vec3 rockPerturb=(vec3(0.,nx.y,nx.x)*rockWeights.x+vec3(ny.x,0.,ny.y)*rockWeights.y+vec3(nz.x,nz.y,0.)*rockWeights.z)*.38;
          vec3 rockWorldNormal=normalize(normalize(landscapeNormal)+rockPerturb);
          normal=normalize(mix(normal,mat3(viewMatrix)*rockWorldNormal,rockBlend));
        #endif`);
  };
  material.customProgramCacheKey=()=> 'tidelands-ground-landscape-v5-'+landscape;
  return material;
}
