import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {loadAuthoredCast} from '../src/authored-assets.js';
import {animateAuthoredCharacter} from '../src/authored-character.js';
const name='jacaranda_tree',unit=2.95/1.8195863831788301;
const canvas=document.querySelector('canvas'),out=document.querySelector('#state'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.1,500),loader=new GLTFLoader(),models=new Map();
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;scene.background=new THREE.Color(0xa3b8b5);
scene.add(new THREE.HemisphereLight(0xe2eddf,0x64614d,2));const sun=new THREE.DirectionalLight(0xffe5c5,2.7);sun.position.set(-30,55,30);scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:0x697354,roughness:.97}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const person=(await loadAuthoredCast()).actors.traveler;scene.add(person);
const parts=root=>{const r=[];root.traverse(o=>{if(o.isMesh)r.push(o);});return r;};
let box,size,center,busy=false,frames=[];
async function load(mode){
  if(models.has(mode))return models.get(mode);
  const prefix=mode==='source'?'inland-authored-source':'inland-authored-candidate',filename=mode==='source'?`${name}_1k.gltf`:`${name}_${mode}.gltf`;
  const gltf=await loader.loadAsync(`../dist/${prefix}/${name}/${filename}`),root=gltf.scene;
  if(mode==='source'){
    const leaf=parts(root).find(m=>m.material.name.endsWith('_leaves'));
    const texture=await new THREE.TextureLoader().loadAsync(`../dist/inland-authored-candidate/${name}/textures/${name}_leaves_rgba_1k.png`);
    texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;leaf.material.map=texture;leaf.material.transparent=false;leaf.material.alphaTest=.45;leaf.material.needsUpdate=true;
  }
  root.scale.setScalar(unit);root.visible=false;scene.add(root);models.set(mode,root);return root;
}
const near=await load('near');box=new THREE.Box3().setFromObject(near);size=box.getSize(new THREE.Vector3());center=box.getCenter(new THREE.Vector3());
const mass=new THREE.Group();for(const [x,z,rotation]of [[0,0,0],[-31,-22,.7],[32,-24,2.1],[-41,-56,3.2],[20,-60,4.3]]){const tree=near.clone(true);tree.position.set(x,-box.min.y,z);tree.rotation.y=rotation;tree.visible=true;mass.add(tree);}mass.visible=false;scene.add(mass);
const far=new THREE.Group(),farMass=new THREE.Group();scene.add(far,farMass);far.visible=farMass.visible=false;
// ?bake=1 is the first-run path before any generated layout exists.
const bakeOnly=new URLSearchParams(location.search).has('bake');
const layout=bakeOnly?{frames:[]}:await(await fetch('../dist/inland-authored-candidate/impostor-layout.json')).json();
for(const frame of layout.frames){
  const textures=await Promise.all(['color','normal'].map(kind=>new THREE.TextureLoader().loadAsync(`../dist/inland-authored-candidate/impostors-r1/${name}-${frame.index}-${kind}.png`)));
  textures[0].colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(frame.width,frame.height),new THREE.MeshStandardMaterial({map:textures[0],normalMap:textures[1],side:THREE.DoubleSide,alphaTest:.45,roughness:.9,metalness:0}));
  mesh.position.fromArray(frame.center);mesh.position.y-=box.min.y;mesh.rotation.y=frame.angle*Math.PI/180;mesh.visible=false;far.add(mesh);
}
for(const tree of mass.children){const copy=far.clone(true);copy.position.set(tree.position.x,0,tree.position.z);copy.rotation.y=tree.rotation.y;copy.visible=true;farMass.add(copy);}
for(const option of document.querySelectorAll('#mode option'))if(option.value.startsWith('far'))option.disabled=bakeOnly;
function resize(){renderer.setPixelRatio(innerWidth<600?1:Math.min(devicePixelRatio,1.5));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();}
function draw(){
  const mode=document.querySelector('#mode').value,angle=Number(document.querySelector('#angle').value)*Math.PI/180;
  for(const [key,root]of models){root.visible=key===mode;root.position.y=-box.min.y;}mass.visible=mode==='mass';far.visible=mode==='far';farMass.visible=mode==='far-mass';
  const isMass=mode.includes('mass'),target=isMass?new THREE.Vector3(0,9,-20):new THREE.Vector3(center.x,center.y-box.min.y,center.z),distance=isMass?110:Math.max(size.x,size.y,size.z)*1.55;
  camera.position.set(target.x+Math.sin(angle)*distance,target.y+(isMass?18:4),target.z+Math.cos(angle)*distance);camera.lookAt(target);
  for(const tree of [far,...farMass.children]){const localAngle=Math.atan2(camera.position.x-tree.position.x,camera.position.z-tree.position.z)-tree.rotation.y,index=((Math.round(localAngle/(Math.PI/2))%4)+4)%4;tree.children.forEach((m,i)=>m.visible=i===index);}
  const state={x:isMass?0:box.min.x-2.2,z:isMass?12:center.z,yaw:0,time:10,selected:'axe',attackAt:-100,gatherAt:-100,hurtAt:-100};person.userData.lastPosition=null;
  for(let i=0;i<60;i++){state.time=10+i/60;animateAuthoredCharacter(person,state,1/60,()=>0);}
  renderer.render(scene,camera);out.textContent=JSON.stringify({ready:true,mode,angle:angle*180/Math.PI,sourceHeight:19.46887503564358,sharedUnit:unit,candidateWorldSize:size.toArray(),personHeight:new THREE.Box3().setFromObject(person).getSize(new THREE.Vector3()).y,camera:camera.position.toArray(),target:target.toArray(),treeCount:isMass?5:1,render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures},viewport:[innerWidth,innerHeight],buffer:[canvas.width,canvas.height],bakedFrames:frames.length,glError:renderer.getContext().getError(),scope:'Isolated actual authored mature tree at shared human unit; source uses original1k PBR plus official1k alpha, derivatives use512 PBR. Five-tree diagnostic ground is a composition candidate, not the production inland forest. No saved IDs or contact system changed. No GPU/endurance/main-path/M5 acceptance.'});
}
function bakeMaterial(source,angle,normal){source.map.updateMatrix();return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{map:{value:source.map},mapTransform:{value:source.map.matrix.clone()},normalBake:{value:normal?1:0},angle:{value:angle},cutoff:{value:source.alphaTest||0}},vertexShader:'varying vec2 texUv;varying vec3 worldNormal;uniform mat3 mapTransform;void main(){texUv=(mapTransform*vec3(uv,1.)).xy;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 texUv;varying vec3 worldNormal;uniform sampler2D map;uniform float normalBake,angle,cutoff;void main(){vec4 c=texture2D(map,texUv);if(c.a<max(.01,cutoff))discard;if(normalBake>.5){vec3 n=normalize(worldNormal);if(!gl_FrontFacing)n=-n;vec3 r=vec3(cos(angle),0.,-sin(angle)),f=vec3(sin(angle),0.,cos(angle));gl_FragColor=vec4(vec3(dot(n,r),n.y,dot(n,f))*.5+.5,c.a);}else{gl_FragColor=c;\n#include <colorspace_fragment>\n}}`});}
function normalPng(input){const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.drawImage(input,0,0);const pixels=ctx.getImageData(0,0,1024,1024),d=pixels.data;for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;let x=d[i]/255*2-1,y=d[i+1]/255*2-1,z=d[i+2]/255*2-1,l=Math.hypot(x,y,z);if(l<.1){x=y=0;z=l=1;}d[i]=Math.round((x/l*.5+.5)*255);d[i+1]=Math.round((y/l*.5+.5)*255);d[i+2]=Math.round((z/l*.5+.5)*255);}ctx.putImageData(pixels,0,0);return c.toDataURL('image/png');}
document.querySelector('#bake').onclick=()=>{
  const c=document.createElement('canvas'),r=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(1024,1024);r.setClearColor(0,0);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.NoToneMapping;
  const s=new THREE.Scene(),root=near.clone(true);root.visible=true;root.position.y=0;s.add(root);s.updateMatrixWorld(true);frames=[];
  const b=new THREE.Box3().setFromObject(root),p=b.getCenter(new THREE.Vector3()),radius=Math.max(size.x,size.z)*.5*1.06,height=size.y*1.06,cam=new THREE.OrthographicCamera(-radius,radius,height/2,-height/2,.1,300);
  for(let i=0;i<4;i++){const angle=i*Math.PI/2;cam.position.set(p.x+Math.sin(angle)*100,p.y,p.z+Math.cos(angle)*100);cam.lookAt(p);
    const images={};for(const normal of [false,true]){const materials=[];parts(root).forEach((mesh,index)=>{mesh.material=bakeMaterial(parts(near)[index].material,angle,normal);materials.push(mesh.material);});r.render(s,cam);images[normal?'normal':'color']=normal?normalPng(c):c.toDataURL('image/png');materials.forEach(m=>m.dispose());}
    frames.push({index:i,angle:i*90,width:radius*2,height,center:p.toArray(),...images});
  }
  r.dispose();document.querySelector('#baked-data').value=JSON.stringify({name,unit,frames});draw();
};
for(const el of document.querySelectorAll('select'))el.onchange=async()=>{if(busy)return;busy=true;try{const mode=document.querySelector('#mode').value;if(!['mass','far','far-mass'].includes(mode))await load(mode);draw();}catch(e){out.textContent=JSON.stringify({ready:false,error:e.message});throw e;}finally{busy=false;}};
window.addEventListener('resize',()=>{resize();draw();});resize();draw();document.querySelector('#bake').disabled=false;
