import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {animateAuthoredCharacter} from '../src/authored-character.js';
const canvas=document.querySelector('canvas'),out=document.querySelector('output'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.05,150),loader=new GLTFLoader(),assets=new Map();
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;scene.background=new THREE.Color(0x889792);
scene.add(new THREE.HemisphereLight(0xe2eddf,0x6c6850,2));const sun=new THREE.DirectionalLight(0xffe3bf,2.8);sun.position.set(-8,13,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.1,far:80});sun.shadow.bias=-.0005;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x7b8064,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const cast=await loadAuthoredCast(),person=cast.actors.traveler;scene.add(person);let baked=false;
function parts(root){const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});return meshes;}
for(const name of ['island_tree_01','island_tree_02','island_tree_03']){
  const [source,near,mid]=await Promise.all([loader.loadAsync('../dist/canopy-authored-source/'+name+'/'+name+'_1k.gltf'),...['near','mid'].map(level=>loader.loadAsync('../dist/canopy-authored-candidate/'+name+'/'+name+'_'+level+'.gltf'))]);
  const materials=parts(near.scene).map(m=>m.material),obsoleteMaterials=new Set(),obsoleteTextures=new Set();
  for(const root of [source.scene,mid.scene])parts(root).forEach((mesh,i)=>{const material=mesh.material;if(!materials.includes(material)){obsoleteMaterials.add(material);for(const v of Object.values(material))if(v?.isTexture)obsoleteTextures.add(v);}mesh.material=materials[i];});
  for(const texture of obsoleteTextures)texture.dispose();for(const material of obsoleteMaterials)material.dispose();
  const box=new THREE.Box3().setFromObject(source.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),entry={name,source:source.scene,near:near.scene,mid:mid.scene,box,size,center,far:new THREE.Group(),frames:[]};
  for(const root of [entry.source,entry.near,entry.mid,entry.far]){root.visible=false;root.position.y=-box.min.y;scene.add(root);parts(root).forEach(mesh=>{mesh.castShadow=mesh.receiveShadow=true;mesh.material.alphaToCoverage=true;});}assets.set(name,entry);
}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setPixelRatio(w<600?1:Math.min(devicePixelRatio,1.5));renderer.setSize(w,h,false);camera.aspect=w/h;camera.zoom=Math.min(1,camera.aspect/.9);camera.updateProjectionMatrix();}
function draw(){const name=document.querySelector('#asset').value,mode=document.querySelector('#mode').value,angle=Number(document.querySelector('#angle').value)*Math.PI/180,entry=assets.get(name);
  for(const asset of assets.values())for(const key of ['source','near','mid','far'])asset[key].visible=asset===entry&&key===mode;
  if(mode==='far'){entry.far.children.forEach((mesh,i)=>mesh.visible=i===Math.round(angle/(Math.PI/2))%4);}
  const coverage=new URLSearchParams(location.search).get('coverage')==='msaa';
  for(const asset of assets.values())for(const key of ['source','near','mid'])parts(asset[key]).forEach(mesh=>{if(mesh.material.name.endsWith('_leaves')){mesh.material.alphaTest=coverage?0:.45;mesh.material.needsUpdate=true;}});
  const center=entry.center.clone();center.y-=entry.box.min.y;const distance=document.querySelector('#range').value==='far'?45:Math.max(entry.size.y,entry.size.x,entry.size.z)*1.65;
  camera.position.set(center.x+Math.sin(angle)*distance,center.y+entry.size.y*.12,center.z+Math.cos(angle)*distance);camera.lookAt(center);
  const personState={x:entry.box.min.x-.85,z:entry.center.z,yaw:0,time:10,selected:'axe',attackAt:-100,gatherAt:-100,hurtAt:-100};person.userData.lastPosition=null;
  for(let i=0;i<60;i++){personState.time=10+i/60;animateAuthoredCharacter(person,personState,1/60,()=>0);}
  const personBox=new THREE.Box3().setFromObject(person);
  renderer.render(scene,camera);out.textContent=JSON.stringify({ready:true,asset:name,mode,coverage:coverage?'msaa-opacity':'cutoff-0.45',angle:angle*180/Math.PI,baked,distance,nativeSize:entry.size.toArray(),camera:camera.position.toArray(),cameraTarget:center.toArray(),personMinY:personBox.min.y,personPlan:person.userData.plan,render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures},viewport:[innerWidth,innerHeight],buffer:[canvas.width,canvas.height],glError:renderer.getContext().getError(),scope:'Native-size author coastal tree on diagnostic ground with actual traveler reset and60 fixed settling frames after each declared relocation. Source/near/mid share the same512 PBR and official alpha; far uses four native baked views with normalized tangent normals. Static isolated representation review, no ordinary world integration, wind/collision/GPU/endurance/M5 acceptance.'});
}
function bakingMaterial(source,angle,normal){
  source.map.updateMatrix();return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{map:{value:source.map},mapTransform:{value:source.map.matrix.clone()},cutoff:{value:source.alphaTest||0},angle:{value:angle},normalBake:{value:normal?1:0}},vertexShader:`varying vec2 texUv;varying vec3 worldNormal;uniform mat3 mapTransform;void main(){texUv=(mapTransform*vec3(uv,1.)).xy;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 texUv;varying vec3 worldNormal;uniform sampler2D map;uniform float cutoff,angle,normalBake;void main(){vec4 color=texture2D(map,texUv);if(color.a<max(.01,cutoff))discard;if(normalBake>.5){vec3 n=normalize(worldNormal);if(!gl_FrontFacing)n=-n;vec3 right=vec3(cos(angle),0.,-sin(angle)),front=vec3(sin(angle),0.,cos(angle));gl_FragColor=vec4(vec3(dot(n,right),n.y,dot(n,front))*.5+.5,color.a);}else{gl_FragColor=color;#include <colorspace_fragment>}}`.replace('color;#include','color;\n#include')});
}
function normalPng(source){
  // MSAA mixes different leaf normals in one pixel; store unit vectors again.
  const copy=document.createElement('canvas');copy.width=copy.height=512;const context=copy.getContext('2d');context.drawImage(source,0,0);const pixels=context.getImageData(0,0,512,512),data=pixels.data;
  for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;let x=data[i]/255*2-1,y=data[i+1]/255*2-1,z=data[i+2]/255*2-1,length=Math.hypot(x,y,z);if(length<.1){x=y=0;z=length=1;}data[i]=Math.round((x/length*.5+.5)*255);data[i+1]=Math.round((y/length*.5+.5)*255);data[i+2]=Math.round((z/length*.5+.5)*255);}
  context.putImageData(pixels,0,0);return copy.toDataURL('image/png');
}
document.querySelector('#bake').onclick=()=>{
  document.querySelectorAll('select,button').forEach(e=>e.disabled=true);const renderScene=new THREE.Scene(),bakeCamera=new THREE.OrthographicCamera(),bakeCanvas=document.createElement('canvas'),baker=new THREE.WebGLRenderer({canvas:bakeCanvas,alpha:true,antialias:true,preserveDrawingBuffer:true});baker.setSize(512,512);baker.setClearColor(0,0);baker.outputColorSpace=THREE.SRGBColorSpace;
  for(const entry of assets.values()){
    const root=entry.near.clone(true),center=entry.center.clone(),width=Math.max(entry.size.x,entry.size.z)*1.05,height=entry.size.y*1.05;root.visible=true;root.position.y=-entry.box.min.y;center.y-=entry.box.min.y;renderScene.add(root);
    bakeCamera.left=-width/2;bakeCamera.right=width/2;bakeCamera.top=height/2;bakeCamera.bottom=-height/2;bakeCamera.near=.01;bakeCamera.far=50;bakeCamera.updateProjectionMatrix();
    const roots=parts(root),original=roots.map(m=>m.material);
    for(let frame=0;frame<4;frame++){
      const angle=frame*Math.PI/2;bakeCamera.position.set(center.x+Math.sin(angle)*15,center.y,center.z+Math.cos(angle)*15);bakeCamera.lookAt(center);
      const textures={};for(const kind of ['color','normal']){
        roots.forEach((mesh,i)=>mesh.material=bakingMaterial(original[i],angle,kind==='normal'));baker.render(renderScene,bakeCamera);
        const url=kind==='normal'?normalPng(bakeCanvas):bakeCanvas.toDataURL('image/png'),image=document.createElement('img');image.alt=entry.name+'-'+frame+'-'+kind;image.dataset.file=entry.name+'-'+frame+'-'+kind+'.png';image.src=url;document.querySelector('#exports').append(image);
        textures[kind]=new THREE.TextureLoader().load(url);if(kind==='color')textures[kind].colorSpace=THREE.SRGBColorSpace;roots.forEach(mesh=>mesh.material.dispose());
      }
      const material=new THREE.MeshStandardMaterial({map:textures.color,normalMap:textures.normal,roughness:1,alphaTest:.45,alphaToCoverage:true,side:THREE.DoubleSide}),plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);plane.position.copy(entry.center);plane.rotation.y=angle;plane.castShadow=plane.receiveShadow=true;entry.far.add(plane);entry.frames.push({frame,width,height,angle});
    }
    roots.forEach((mesh,i)=>mesh.material=original[i]);renderScene.remove(root);
  }
  baker.dispose();baked=true;document.querySelectorAll('select,button').forEach(e=>e.disabled=false);resize();draw();
};
document.querySelectorAll('select').forEach(e=>e.onchange=()=>{resize();draw();});window.addEventListener('resize',()=>{resize();draw();});
window.addEventListener('pagehide',()=>{cast.release();const geometries=new Set(),materials=new Set(),textures=new Set();for(const entry of assets.values())for(const key of ['source','near','mid','far'])for(const part of parts(entry[key])){geometries.add(part.geometry);materials.add(part.material);}for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());renderer.dispose();});
document.querySelectorAll('select,button').forEach(e=>e.disabled=false);resize();draw();
