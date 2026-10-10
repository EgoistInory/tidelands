import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {createGroundSurface} from '../src/ground-surface.js';

function fixture(){
  const requests=[],detail=new THREE.DataTexture(new Uint8Array([220,220,220,255]),1,1);
  const loader={load(url,done,_progress,fail){const texture=new THREE.Texture();requests.push({url,done,fail,texture});return texture;}};
  const material=createGroundSurface(detail,{loader,anisotropy:16});
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};
  material.onBeforeCompile(shader);
  return {requests,material,shader,detail};
}

test('ground remains on the original surface until all three channels load',async()=>{
  const {requests,material,shader,detail}=fixture(),ground=material.userData.ground;
  assert.equal(material.map,detail);assert.equal(material.bumpMap,detail);
  assert.equal(shader.uniforms.groundReady.value,0);
  requests[1].done();requests[0].done();
  assert.equal(ground.state.status,'loading');assert.equal(shader.uniforms.groundReady.value,0);
  requests[2].done();assert.equal(await ground.loaded,ground.state);
  assert.equal(ground.state.status,'ready');assert.equal(ground.state.loaded,3);
  assert.equal(shader.uniforms.groundReady.value,1);
  assert.equal(shader.uniforms.groundEnabled,ground.enabled);
});

test('a missing channel keeps the fallback and settles the load status',async t=>{
  t.mock.method(console,'warn',()=>{});
  const {requests,material,shader}=fixture(),ground=material.userData.ground;
  requests[0].done();requests[2].fail();requests[1].fail();
  await ground.loaded;
  assert.equal(ground.state.status,'fallback');assert.equal(ground.state.loaded,1);
  assert.deepEqual(ground.state.failed,['roughness.jpg','normal-gl.jpg']);
  assert.equal(shader.uniforms.groundReady.value,0);
  assert.equal(console.warn.mock.callCount(),1);
});

test('ground channels use local URLs, matching two metre tiles and appropriate colour spaces',()=>{
  const {requests,material,shader}=fixture();
  assert.ok(requests.every(r=>r.url.startsWith(new URL('../assets/ground/leafy-grass/',import.meta.url).href)));
  const albedo=shader.uniforms.groundAlbedo.value;
  assert.equal(albedo,requests[0].texture);assert.equal(albedo.colorSpace,THREE.SRGBColorSpace);
  assert.equal(material.normalMap,requests[1].texture);assert.equal(material.normalMap.colorSpace,THREE.NoColorSpace);
  assert.equal(material.roughnessMap,requests[2].texture);assert.equal(material.roughnessMap.colorSpace,THREE.NoColorSpace);
  for(const {texture} of requests){
    assert.equal(texture.wrapS,THREE.RepeatWrapping);assert.equal(texture.wrapT,THREE.RepeatWrapping);
    assert.deepEqual(texture.repeat.toArray(),[400,400]);assert.equal(texture.anisotropy,4);
    assert.equal(texture.generateMipmaps,true);assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);
  }
  assert.ok(material.normalScale.x>0&&material.normalScale.x<1);
});

test('bundled CC0 channel bytes agree with the provenance manifest',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/ground/leafy-grass/manifest.json',import.meta.url)));
  assert.equal(manifest.license,'CC0-1.0');assert.equal(manifest.tileWidthMeters,2);
  assert.equal(manifest.files.length,3);
  for(const file of manifest.files){
    const bytes=readFileSync(new URL(`../${file.path}`,import.meta.url));
    assert.equal(bytes.length,file.bytes);assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);
    for(const algorithm of ['md5','sha256'])assert.equal(createHash(algorithm).update(bytes).digest('hex'),file[algorithm]);
  }
});
