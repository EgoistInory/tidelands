import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {createGroundSurface} from '../src/ground-surface.js';
import {createRockSurface} from '../src/rock-surface.js';

test('landscape shares decoded rock channels and keeps preprocessor directives separated',async()=>{
  const requests=[],loader={load(url,done,_p,fail){const texture=new THREE.Texture();requests.push({url,done,fail,texture});return texture;}};
  const rock=createRockSurface({loader}),material=createGroundSurface(new THREE.Texture(),{loader,landscape:true,rockSurface:rock});
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <color_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>'};
  material.onBeforeCompile(shader);assert.equal(requests.length,9,'rock maps reused, not loaded a second time');
  assert.equal(shader.uniforms.groundRockAlbedo.value,requests[0].texture);assert.equal(shader.uniforms.groundRockNormal.value,rock.normalMap);
  assert.equal(shader.uniforms.groundRockRoughness.value,rock.roughnessMap);assert.equal(shader.uniforms.groundRockReady,rock.userData.rock.ready);
  assert.equal(shader.uniforms.groundRockReady.value,0);requests.forEach(r=>r.done());await rock.userData.rock.loaded;
  assert.equal(shader.uniforms.groundRockReady.value,1);
  for(const source of [shader.vertexShader,shader.fragmentShader])assert.ok(!/#endif\S/.test(source),'preprocessor line must not swallow the following expression');
  const failed=createRockSurface({loader});const warning=console.warn;console.warn=()=>{};
  try{requests[9].fail();requests[10].done();requests[11].done();await failed.userData.rock.loaded;assert.equal(failed.userData.rock.ready.value,0);}finally{console.warn=warning;}
});

function fixture(){
  const requests=[],detail=new THREE.DataTexture(new Uint8Array([220,220,220,255]),1,1);
  const loader={load(url,done,_progress,fail){const texture=new THREE.Texture();requests.push({url,done,fail,texture});return texture;}};
  const material=createGroundSurface(detail,{loader,anisotropy:16});
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};
  material.onBeforeCompile(shader);
  return {requests,material,shader,detail};
}

test('decoded texture lists exclude failed and pending channels and remain per surface',async t=>{
  t.mock.method(console,'warn',()=>{});
  const {requests,material}=fixture(),g=material.userData.ground;
  assert.deepEqual(g.textures,[]);assert.deepEqual(g.sand.textures,[]);
  requests[0].done();requests[1].fail();requests[2].done();
  requests[3].done();requests[4].done();requests[5].done();
  await Promise.all([g.loaded,g.sand.loaded]);
  assert.deepEqual(g.textures,[requests[0].texture,requests[2].texture]);
  assert.deepEqual(g.sand.textures,requests.slice(3).map(r=>r.texture));
  assert.notEqual(g.textures,fixture().material.userData.ground.textures);
});

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

test('shore wetness toggle remains independent of channel loading and requests no textures',async t=>{
  t.mock.method(console,'warn',()=>{});
  const {requests,material,shader}=fixture(),other=fixture();
  const wetness=material.userData.ground.wetness;
  assert.equal(wetness.value,1);assert.equal(shader.uniforms.groundWetness,wetness);
  assert.notEqual(wetness,other.material.userData.ground.wetness);
  requests[0].fail();requests[1].done();requests[2].done();await material.userData.ground.loaded;
  assert.equal(shader.uniforms.groundReady.value,0);assert.equal(wetness.value,1);assert.equal(requests.length,6);
  wetness.value=0;assert.equal(shader.uniforms.groundWetness.value,0);
  assert.equal(requests.length,6);
  assert.equal(other.material.userData.ground.wetness.value,1);
});

test('ground channels use local URLs, matching two metre tiles and appropriate colour spaces',()=>{
  const {requests,material,shader}=fixture();
  assert.ok(requests.slice(0,3).every(r=>r.url.startsWith(new URL('../assets/ground/leafy-grass/',import.meta.url).href)));
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

test('coastal sand waits for its own three channels while the grass can already render',async()=>{
  const {requests,material,shader}=fixture(),ground=material.userData.ground,sand=ground.sand;
  assert.ok(sand,'independent coastal surface state');assert.equal(requests.length,6);
  requests.slice(0,3).forEach(r=>r.done());await ground.loaded;
  assert.equal(ground.state.status,'ready');assert.equal(sand.state.status,'loading');
  assert.equal(shader.uniforms.groundReady.value,1);assert.equal(shader.uniforms.groundSandReady.value,0);
  requests[3].done();requests[5].done();assert.equal(shader.uniforms.groundSandReady.value,0);
  requests[4].done();await sand.loaded;
  assert.equal(sand.state.status,'ready');assert.equal(sand.state.loaded,3);assert.equal(shader.uniforms.groundSandReady.value,1);
  assert.equal(shader.uniforms.groundSandEnabled,sand.enabled);sand.enabled.value=0;
  assert.equal(shader.uniforms.groundSandEnabled.value,0);assert.equal(ground.enabled.value,1);assert.equal(ground.wetness.value,1);
  for(const r of requests.slice(3))assert.ok(r.url.startsWith(new URL('../assets/ground/coastal-sand/',import.meta.url).href));
  assert.equal(shader.uniforms.groundSandAlbedo.value,requests[3].texture);assert.equal(requests[3].texture.colorSpace,THREE.SRGBColorSpace);
  assert.equal(shader.uniforms.groundSandNormal.value,requests[4].texture);assert.equal(requests[4].texture.colorSpace,THREE.NoColorSpace);
  assert.equal(shader.uniforms.groundSandRoughness.value,requests[5].texture);assert.equal(requests[5].texture.colorSpace,THREE.NoColorSpace);
});

test('grass or sand failure leaves the other surface and wetness available',async t=>{
  t.mock.method(console,'warn',()=>{});
  for(const failedGroup of [0,1]){
    const {requests,material,shader}=fixture(),ground=material.userData.ground,sand=ground.sand;
    assert.ok(sand,'independent fallback state');
    requests.forEach((r,i)=>i===failedGroup*3?r.fail():r.done());await Promise.all([ground.loaded,sand.loaded]);
    assert.equal(ground.state.status,failedGroup===0?'fallback':'ready');assert.equal(sand.state.status,failedGroup===1?'fallback':'ready');
    assert.equal(shader.uniforms.groundReady.value,failedGroup===0?0:1);assert.equal(shader.uniforms.groundSandReady.value,failedGroup===1?0:1);
    assert.equal(ground.wetness.value,1);
  }
  assert.equal(console.warn.mock.callCount(),2);
});

test('bundled sand channels agree with their official source hashes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/ground/coastal-sand/manifest.json',import.meta.url)));
  assert.equal(manifest.assetId,'sand_03');assert.equal(manifest.license,'CC0-1.0');assert.equal(manifest.tileWidthMeters,2);
  assert.equal(manifest.files.length,3);
  for(const file of manifest.files){const bytes=readFileSync(new URL(`../${file.path}`,import.meta.url));
    assert.equal(bytes.length,file.bytes);for(const algorithm of ['md5','sha256'])assert.equal(createHash(algorithm).update(bytes).digest('hex'),file[algorithm]);
  }
});
