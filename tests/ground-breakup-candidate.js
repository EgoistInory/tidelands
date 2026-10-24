// Isolated surface experiment: no terrain, resource, vegetation or save mutations.
export function installGroundBreakup(material){
  const amount={value:0},compile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    compile(shader);shader.uniforms.groundBreakup=amount;
    shader.fragmentShader=`uniform float groundBreakup;
      float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.,1.)),f.x),f.y);}
      ${shader.fragmentShader}`
      .replace('rockBlend=landscapeLayers.x*groundRockReady;',`rockBlend=mix(landscapeLayers.x,smoothstep(.08,.88,landscapeLayers.x+(groundNoise(groundPosition.xz*.09)-.5)*.28),groundBreakup)*groundRockReady;`)
      .replace('vec3 grassColor=texture2D(groundAlbedo,vec2(groundPosition.x,-groundPosition.z)*.5).rgb;',`vec2 grassUv=vec2(groundPosition.x,-groundPosition.z)*.5;
        vec3 grassColor=texture2D(groundAlbedo,grassUv).rgb;
        vec2 grassTurn=mat2(.8,-.6,.6,.8)*grassUv+vec2(17.37,9.13);
        grassColor=mix(grassColor,mix(grassColor,texture2D(groundAlbedo,grassTurn*.83).rgb,smoothstep(.2,.8,groundNoise(groundPosition.xz*.11))),groundBreakup);`)
      .replace('diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,.65,.48)',`float broadPatch=groundNoise(groundPosition.xz*.045+vec2(groundNoise(groundPosition.xz*.12)*2.));
        float dryPatch=smoothstep(.48,.78,broadPatch)*grassBlend*groundBreakup;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.89,.77,.57),dryPatch*.7);
        diffuseColor.rgb*=1.-groundBreakup*grassBlend*smoothstep(.5,.85,1.-broadPatch)*.18;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,.65,.48)`);
  };
  material.customProgramCacheKey=()=> 'tidelands-ground-breakup-isolated-v1';material.needsUpdate=true;
  return amount;
}
