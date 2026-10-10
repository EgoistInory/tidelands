import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {createRockSurface} from '../src/rock-surface.js';
import {createWeatheredRock} from '../src/rock.js';

function fixture(){const requests=[];return {requests,loader:{load(url,success,progress,failure){const texture=new THREE.Texture();requests.push({url,success,failure,texture});return texture;}}};}
function shaderFor(material){const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};material.onBeforeCompile(shader);return shader;}

test('rock photo channels become visible together, with correct local sampling and no repeated loads',async()=>{
  const {requests,loader}=fixture(),material=createRockSurface({loader,anisotropy:16}),shader=shaderFor(material),rock=material.userData.rock;
  assert.equal(shader.uniforms.rockReady.value,0);assert.equal(rock.state.status,'loading');
  requests[0].success();requests[1].success();assert.equal(shader.uniforms.rockReady.value,0);
  requests[2].success();await rock.loaded;assert.equal(shader.uniforms.rockReady.value,1);assert.equal(rock.state.status,'ready');
  rock.load(loader,16);assert.equal(requests.length,3);
  assert.equal(requests[0].texture.colorSpace,THREE.SRGBColorSpace);
  for(const request of requests){assert.ok(request.url.startsWith(new URL('../assets/rock/lichen-rock/',import.meta.url).href));assert.equal(request.texture.anisotropy,4);assert.equal(request.texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(request.texture.generateMipmaps,true);assert.deepEqual(request.texture.repeat.toArray(),[Math.PI,Math.PI/2]);}
  assert.equal(material.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(material.roughnessMap.colorSpace,THREE.NoColorSpace);
  assert.ok(shader.fragmentShader.indexOf('#include <color_fragment>')<shader.fragmentShader.indexOf('texture2D(rockAlbedo'));
  assert.ok(shader.fragmentShader.includes('mix(normal,normalize(tbn*rockNormal),rockBlend)'));
  material.dispose();
});

test('missing rock channels preserve original colour, normal and roughness and settle readiness',async()=>{
  const {requests,loader}=fixture(),warnings=[],originalWarn=console.warn;console.warn=message=>warnings.push(message);
  try{
    const material=createRockSurface({loader}),shader=shaderFor(material),rock=material.userData.rock;
    requests[0].success();requests[1].failure();requests[2].failure();await rock.loaded;
    assert.equal(shader.uniforms.rockReady.value,0);assert.equal(rock.state.status,'fallback');assert.equal(warnings.length,1);assert.equal(rock.state.failed.length,2);
    assert.equal(material.vertexColors,true);assert.equal(material.roughness,.93);material.dispose();
  }finally{console.warn=originalWarn;}
});

test('spherical UVs remain finite with whole longitude tiles and radius-scaled vertical density',()=>{
  const a=createWeatheredRock(1.8),b=createWeatheredRock(.8),ua=a.geometry.attributes.uv,ub=b.geometry.attributes.uv;
  assert.equal(a.geometry.attributes.position.count/3,320);assert.equal(ua.count,ub.count);
  for(let i=0;i<ua.count;i++){assert.ok(Number.isFinite(ua.getX(i))&&Number.isFinite(ua.getY(i)));assert.ok(Math.abs(ua.getX(i)/6-ub.getX(i)/3)<1e-6);assert.ok(Math.abs(ua.getY(i)/1.8-ub.getY(i)/.8)<1e-6);}
  a.geometry.dispose();b.geometry.dispose();
});

test('bundled rock channels match the official metadata and saved SHA256 manifest',()=>{
  const root=new URL('../assets/rock/lichen-rock/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
  assert.equal(manifest.license,'CC0');assert.equal(manifest.author,'Rico Cilliers');assert.equal(manifest.metres,2);assert.equal(manifest.runtimeNetwork,false);
  for(const [file,metadata]of Object.entries(manifest.files)){const data=fs.readFileSync(new URL(file,root));assert.equal(data.length,metadata.bytes);assert.equal(createHash('md5').update(data).digest('hex'),metadata.md5);assert.equal(createHash('sha256').update(data).digest('hex'),metadata.sha256);assert.equal(data.readUInt16BE(0),0xffd8);assert.equal(data.readUInt16BE(data.length-2),0xffd9);}
});
