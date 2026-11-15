import test from 'node:test';import assert from 'node:assert/strict';import * as T from '../vendor/three.module.min.js';
import {prepareCameraOccluder,createForegroundFade} from '../tools/camera_occlusion_candidate.js';
test('foreground hook composes the wind shader once and preserves opaque/shadow and texture ownership',()=>{
 const map=new T.DataTexture(new Uint8Array(16),2,2),m=new T.MeshStandardMaterial({map,alphaTest:.4,alphaToCoverage:true}),depth=new T.MeshDepthMaterial(),root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),m);mesh.customDepthMaterial=depth;root.add(mesh);let calls=0,disposed=0;map.addEventListener('dispose',()=>disposed++);m.onBeforeCompile=shader=>{calls++;shader.vertexShader='// existing wind\n'+shader.vertexShader;};m.customProgramCacheKey=()=> 'existing-wind';
 prepareCameraOccluder(root);const callback=m.onBeforeCompile;prepareCameraOccluder(root);assert.equal(callback,m.onBeforeCompile);
 const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <dithering_fragment>'};m.onBeforeCompile(shader);assert.equal(calls,1);assert(shader.vertexShader.includes('existing wind')&&shader.vertexShader.includes('cameraOcclusionWorld'));assert(shader.fragmentShader.includes('discard'));assert(m.customProgramCacheKey().includes('existing-wind'));assert.equal(m.alphaTest,.4);assert(m.alphaToCoverage&&!m.transparent);assert.equal(mesh.customDepthMaterial,depth);assert.equal(m.map,map);assert.equal(disposed,0);
 mesh.geometry.dispose();m.dispose();depth.dispose();map.dispose();
});
test('LOD material replacement on an existing mesh is prepared without cloning its shared map',()=>{
 const a=new T.MeshStandardMaterial(),b=new T.MeshStandardMaterial(),mesh=new T.Mesh(new T.BoxGeometry(),a);prepareCameraOccluder(mesh);mesh.material=b;prepareCameraOccluder(mesh);assert(b.customProgramCacheKey().includes('camera-occlusion'));a.dispose();b.dispose();mesh.geometry.dispose();
});
test('foreground fade eases in and out while each view retains its own amount',()=>{
 const a=createForegroundFade(),b=createForegroundFade(),focus=new T.Vector3(0,1.4,0),camera=new T.Vector3(0,3,14),original=focus.clone();a.update(focus,camera,true,1/60);assert(a.amount>0&&a.amount<1);const first=a.amount;
 b.update(focus,camera,false,1/60);assert.equal(b.amount,0);assert.equal(a.amount,first);for(let n=0;n<120;n++)a.update(focus,camera,false,1/60);assert(a.amount<.001);assert(focus.equals(original));
});
