// QA-only shader variant. Production ground material and shipped bundles stay untouched.
export function installGroundRockSamplingCandidate(material){
  if(!material.defines?.GROUND_LANDSCAPE)return material;
  const original=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,...args){
    original.call(this,shader,...args);
    const coords='vec2 rockX=groundPosition.zy*.33,rockY=groundPosition.xz*.33,rockZ=groundPosition.xy*.33;';
    if(!shader.fragmentShader.includes(coords))throw Error('Ground triplanar coordinates hook changed');
    shader.fragmentShader=shader.fragmentShader.replace(coords,`${coords}
      #ifdef GROUND_LANDSCAPE
        // Explicit gradients keep mip selection defined across the divergent branch.
        vec2 rockXdx=dFdx(rockX),rockXdy=dFdy(rockX),rockYdx=dFdx(rockY),rockYdy=dFdy(rockY),rockZdx=dFdx(rockZ),rockZdy=dFdy(rockZ);
      #endif`);
    const albedo='rockColor=texture2D(groundRockAlbedo,rockX).rgb*rockWeights.x+texture2D(groundRockAlbedo,rockY).rgb*rockWeights.y+texture2D(groundRockAlbedo,rockZ).rgb*rockWeights.z;';
    if(!shader.fragmentShader.includes(albedo))throw Error('Ground rock albedo hook changed');
    shader.fragmentShader=shader.fragmentShader.replace(albedo,`if(rockBlend>0.)rockColor=textureGrad(groundRockAlbedo,rockX,rockXdx,rockXdy).rgb*rockWeights.x+textureGrad(groundRockAlbedo,rockY,rockYdx,rockYdy).rgb*rockWeights.y+textureGrad(groundRockAlbedo,rockZ,rockZdx,rockZdy).rgb*rockWeights.z;`);
    const roughness='float rockRoughness=texture2D(groundRockRoughness,rockX).g*rockWeights.x+texture2D(groundRockRoughness,rockY).g*rockWeights.y+texture2D(groundRockRoughness,rockZ).g*rockWeights.z;';
    if(!shader.fragmentShader.includes(roughness))throw Error('Ground rock roughness hook changed');
    shader.fragmentShader=shader.fragmentShader.replace(roughness,`float rockRoughness=1.;
        #ifdef GROUND_LANDSCAPE
          if(rockBlend>0.)rockRoughness=textureGrad(groundRockRoughness,rockX,rockXdx,rockXdy).g*rockWeights.x+textureGrad(groundRockRoughness,rockY,rockYdx,rockYdy).g*rockWeights.y+textureGrad(groundRockRoughness,rockZ,rockZdx,rockZdy).g*rockWeights.z;
        #endif`);
    const normals='vec3 nx=texture2D(groundRockNormal,rockX).xyz*2.-1.,ny=texture2D(groundRockNormal,rockY).xyz*2.-1.,nz=texture2D(groundRockNormal,rockZ).xyz*2.-1.;';
    if(!shader.fragmentShader.includes(normals))throw Error('Ground rock normal hook changed');
    shader.fragmentShader=shader.fragmentShader.replace(normals,`if(rockBlend>0.){
            vec3 nx=textureGrad(groundRockNormal,rockX,rockXdx,rockXdy).xyz*2.-1.,ny=textureGrad(groundRockNormal,rockY,rockYdx,rockYdy).xyz*2.-1.,nz=textureGrad(groundRockNormal,rockZ,rockZdx,rockZdy).xyz*2.-1.;`)
      .replace('normal=normalize(mix(normal,mat3(viewMatrix)*rockWorldNormal,rockBlend));','normal=normalize(mix(normal,mat3(viewMatrix)*rockWorldNormal,rockBlend));\n          }');
  };
  material.customProgramCacheKey=()=>`${material.userData.groundSamplingBaseKey??'tidelands-ground-landscape-v5'}-zero-rock-skip-explicit-grad`;
  return material;
}
