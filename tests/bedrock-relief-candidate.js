// Isolated appearance study. No terrain displacement, new assets, resources or collision.
export function createBedrockReliefCandidate(base){
  const material=base.clone();material.defines={...base.defines};
  material.onBeforeCompile=shader=>{
    base.onBeforeCompile(shader);
    shader.fragmentShader=`
      float bedrockHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float bedrockNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(bedrockHash(i),bedrockHash(i+vec2(1.,0.)),f.x),
          mix(bedrockHash(i+vec2(0.,1.)),bedrockHash(i+vec2(1.)),f.x),f.y);
      }
      ${shader.fragmentShader}`;
    shader.fragmentShader=shader.fragmentShader.replace('float grassBlend=groundReady',`
      // Metre-scale weathered beds, with interrupted seams rather than another fine tile.
      float bedrockMass=bedrockNoise(groundPosition.xz*.17);
      float bedrockChips=bedrockNoise(groundPosition.xz*.62+bedrockMass);
      float bedrockPhase=(groundPosition.y+bedrockMass*2.1+sin(groundPosition.x*.065)*.6)*3.;
      float bedrockSeam=(1.-smoothstep(.025,.16,abs(sin(bedrockPhase))))*smoothstep(.25,.62,bedrockChips);
      float bedrockWeight=smoothstep(.28,.8,rockBlend);
      float bedrockHeight=(bedrockMass*.50+bedrockChips*.12-bedrockSeam*.11)*bedrockWeight;
      float grassBlend=groundReady`);
    shader.fragmentShader=shader.fragmentShader.replace('diffuseColor.rgb*=mix(1.,.64,shoreWetness);',`
      diffuseColor.rgb*=1.-bedrockWeight*(bedrockSeam*.22+(1.-bedrockMass)*.12);
      diffuseColor.rgb*=mix(1.,.64,shoreWetness);`);
    const marker='normal=normalize(mix(normal,mat3(viewMatrix)*rockWorldNormal,rockBlend));';
    shader.fragmentShader=shader.fragmentShader.replace(marker,marker+`
      normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(bedrockHeight),dFdy(bedrockHeight)),faceDirection);`);
  };
  material.customProgramCacheKey=()=>base.customProgramCacheKey()+'-bedrock-relief-study-v1';
  return {material,release(){material.dispose();}};
}
