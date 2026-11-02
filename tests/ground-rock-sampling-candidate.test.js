import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createGroundSurface} from '../src/ground-surface.js';
import {installGroundRockSamplingCandidate} from './ground-rock-sampling-candidate.js';

function material(landscape=true,candidate=false){
  const loader={load(){return new THREE.Texture();}},m=createGroundSurface(new THREE.Texture(),{loader,landscape});
  if(candidate)installGroundRockSamplingCandidate(m);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};
  m.onBeforeCompile(shader);return {m,shader};
}

test('landscape zero-rock candidate guards all triplanar channels with explicit gradients',()=>{
  const {shader:fresh}=material(true,true);
  assert.match(fresh.fragmentShader,/rockXdx=dFdx\(rockX\).*rockZdy=dFdy\(rockZ\)/s);
  assert.match(fresh.fragmentShader,/if\(rockBlend>0\.\)rockColor=textureGrad\(groundRockAlbedo/);
  assert.match(fresh.fragmentShader,/float rockRoughness=1\.;[\s\S]*if\(rockBlend>0\.\)rockRoughness=textureGrad\(groundRockRoughness/);
  assert.match(fresh.fragmentShader,/if\(rockBlend>0\.\)\{\s*vec3 nx=textureGrad\(groundRockNormal/);
  assert.match(fresh.fragmentShader,/mix\(diffuseColor\.rgb,rockColor\*\.78\+diffuseColor\.rgb\*\.22,rockBlend\)/);
  assert.match(fresh.fragmentShader,/mix\(roughnessFactor,rockRoughness,rockBlend\)/);
  assert.match(fresh.fragmentShader,/mix\(normal,mat3\(viewMatrix\)\*rockWorldNormal,rockBlend\)/);
  assert.equal((fresh.fragmentShader.match(/textureGrad\(groundRockAlbedo/g)||[]).length,3);
  assert.equal((fresh.fragmentShader.match(/textureGrad\(groundRockRoughness/g)||[]).length,3);
  assert.equal((fresh.fragmentShader.match(/textureGrad\(groundRockNormal/g)||[]).length,3);
});

test('non-landscape ground receives no triplanar fast-path changes',()=>{
  const {shader:baseline}=material(false),{shader:candidate}=material(false,true);
  assert.equal(candidate.fragmentShader,baseline.fragmentShader);
});

test('candidate fails closed when the underlying production shader hook changes',()=>{
  const m={defines:{GROUND_LANDSCAPE:1},userData:{},onBeforeCompile(shader){shader.fragmentShader='void main(){}';}};installGroundRockSamplingCandidate(m);
  assert.throws(()=>m.onBeforeCompile({uniforms:{},fragmentShader:'void main(){}'}),/coordinates hook changed/);
});
