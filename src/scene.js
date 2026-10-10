import * as THREE from '../vendor/three.module.min.js';
import {terrain,ISLANDS,LANDMARKS,randomGenerator,dayCycle} from './world.js';
import {isDepleted} from './game.js';
import {unobstructedCamera} from './camera.js';
import {createCharacter,animateCharacter} from './character.js';
import {createCreature,animateCreature,resetCreature} from './creature.js';
import {mergeStaticParts} from './merge-parts.js';
import {cottageSurfaces,cottageRoof} from './cottage-surfaces.js';
import {createCanopy,createBerryFoliage,barkSurface,updateFoliage} from './foliage.js';
import {createGroundSurface} from './ground-surface.js';
import {createWeatheredRock,initializeRockSurface} from './rock.js';
import {createMeadow,createFiberClump,updateMeadow,updateGroundCover} from './meadow.js';
import {createSky,updateSky} from './sky.js';

const palette={bark:0x65513d,leaf:0x365a42,lightLeaf:0x68815b,rock:0x858d86,sand:0xd5c8a7,cloth:0xb86636,cream:0xeee1bd};
const materials=new Map();
function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));return materials.get(color);}
function mesh(geometry,color,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o;}
function box(w,h,d,color,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),color,x,y,z);}
function cone(r,h,color,x=0,y=0,z=0,n=7){return mesh(new THREE.ConeGeometry(r,h,n),color,x,y,z);}
function sphere(r,color,x=0,y=0,z=0){return mesh(new THREE.IcosahedronGeometry(r,0),color,x,y,z);}

function person(color=palette.cloth){
  return createCharacter(color);
}
function resourceModel(type){
  const g=new THREE.Group();
  const branch=(geometry,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,barkSurface());m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m;};
  if(type==='tree'){
    g.add(branch(new THREE.CylinderGeometry(.19,.52,6.8,9),0,3.4,0),createCanopy());
    for(let i=0;i<7;i++){
      const angle=i*2.399,r=i===6?0:1.35,y=5.4+(i%3)*1.15;
      if(i<5){const limb=branch(new THREE.CylinderGeometry(.07,.16,2.3,6),Math.cos(angle)*.65,y-1.2,Math.sin(angle)*.65);limb.rotation.z=Math.sin(angle)*.6;limb.rotation.x=Math.cos(angle)*.6;g.add(limb);}
    }
  }else if(type==='stone'){
    const rock=createWeatheredRock(1.8),small=createWeatheredRock(.8);
    rock.position.y=1;rock.scale.set(1.4,.9,1);rock.rotation.z=.3;small.position.set(1.6,.4,1);g.add(rock,small);
  }else if(type==='crystal'){
    for(let i=0;i<3;i++){const s=mesh(new THREE.OctahedronGeometry(.65+i*.15),0x78c3c2,i*.65-.7,.9+i*.3,0);s.scale.y=2.6;g.add(s);}
  }else if(type==='berry'){
    g.add(createBerryFoliage());
    for(let i=0;i<5;i++){
      const angle=i*2.399,end=new THREE.Vector3(Math.cos(angle)*.55,1.05+(i%3)*.22,Math.sin(angle)*.55);
      const base=new THREE.Vector3(Math.cos(angle)*.12,.05,Math.sin(angle)*.12),delta=end.clone().sub(base);
      const stem=branch(new THREE.CylinderGeometry(.016,.038,delta.length(),6));
      stem.position.copy(base.add(end).multiplyScalar(.5));stem.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(stem);
      for(let berry=0;berry<3;berry++){
        const fruit=sphere(.105,0xb85f44,Math.cos(angle)*.94+(berry-1)*.105,1.02+(i%3)*.22-berry*.07,Math.sin(angle)*.94);
        fruit.scale.y=1.1;g.add(fruit);
      }
    }
  }else if(type==='fiber'){
    g.add(createFiberClump());
  }else{const shell=sphere(.6,palette.cream,0,.2,0);shell.scale.y=.35;g.add(shell);}
  return g;
}
export function buildingModel(type){
  const g=new THREE.Group();
  if(type==='campfire'){
    for(let i=0;i<8;i++)g.add(sphere(.3,0x7b8176,Math.cos(i/4*Math.PI)*1.1,.2,Math.sin(i/4*Math.PI)*1.1));
    const log=box(1.6,.25,.3,palette.bark,0,.3,0);log.rotation.y=.7;g.add(log);
    for(const flame of [cone(.6,1.5,0xebae44,0,.95,0),cone(.28,1.4,0xffd88c,0,.8,0)]){
      flame.material=flame.material.clone();flame.material.emissive.copy(flame.material.color);flame.material.emissiveIntensity=2;flame.castShadow=false;g.add(flame);
    }
  }else if(type==='tent'){
    const cloth=new THREE.MeshStandardMaterial({color:0xb9a77c,roughness:1,side:THREE.DoubleSide});
    const panel=vertices=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,cloth);m.castShadow=m.receiveShadow=true;g.add(m);};
    const beam=(from,to,r,color)=>{const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),delta=end.clone().sub(start);const m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),color);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(m);};
    // Open A-frame shelter: separate canvas slopes, stitched hems and a rear wall.
    for(const side of [-1,1]){
      panel([0,2.85,-1.65,side*1.6,.18,-1.65,side*1.6,.18,1.65,0,2.85,-1.65,side*1.6,.18,1.65,0,2.85,1.65]);
      for(const z of [-1.65,0,1.65])beam([0,2.87,z],[side*1.61,.18,z],.022,0xeadbbb);
      beam([side*1.6,.18,-1.65],[side*1.6,.18,1.65],.035,0x7b6547);
      for(const z of [-1.3,1.3]){beam([side*1.6,.45,z],[side*2.1,.1,z],.022,0xdbc79e);beam([side*2.1,0,z],[side*2.1,.3,z],.055,palette.bark);}
      // Rolled back entry flaps leave the interior visibly open.
      panel([0,2.82,1.66,side*1.6,.18,1.66,side*1.05,.35,1.68]);
    }
    panel([-1.6,.18,-1.65,0,2.85,-1.65,1.6,.18,-1.65]);
    beam([0,2.8,-1.78],[0,2.8,1.78],.075,palette.bark);
    beam([0,.1,-1.58],[0,2.8,-1.58],.06,palette.bark);
    g.add(box(2.8,.09,2.9,0x6d7254,0,.09,0));
    const bedding=box(.85,.14,1.8,0x7d8b77,-.45,.2,-.25);g.add(bedding);
    const roll=mesh(new THREE.CylinderGeometry(.19,.19,.85,12),0x9ea487,-.45,.36,-1.05);roll.rotation.z=Math.PI/2;g.add(roll);
  }else if(type==='workbench'){
    // Individual worn boards, braces, storage and tools replace the solid slab.
    for(let i=0;i<5;i++)g.add(box(3,.2,.34,[0x9c784c,0xa88757,0x917248][i%3],0,1.8,(i-2)*.36));
    for(const x of [-1.15,1.15]){
      for(const z of [-.6,.6])g.add(box(.22,1.65,.22,palette.bark,x,.825,z));
      g.add(box(.18,.16,1.42,0x765939,x,.48,0));
    }
    g.add(box(2.5,.15,.14,0x765939,0,.55,-.6),box(2.55,.12,1.35,0x816745,0,.55,0));
    const brace=box(2.5,.12,.12,0x765939,0,1.05,-.6);brace.rotation.z=.35;g.add(brace);
    g.add(box(.8,.55,.7,0x625943,.4,.9,0));
    for(const x of [.08,.72])g.add(box(.07,.57,.73,0x413f35,x,.9,0));
    const hammer=box(.09,.08,.75,0x73583d,.45,1.96,.05);hammer.rotation.y=.45;g.add(hammer);
    g.add(box(.42,.2,.18,0x717778,.6,2.02,.34));
    const stone=mesh(new THREE.SphereGeometry(.35,12,8),0x858a80,-.7,1.99,-.1);stone.scale.set(1,.3,.7);g.add(stone);
    for(const x of [-1.15,1.15])for(const z of [-.65,.65])g.add(mesh(new THREE.CylinderGeometry(.025,.025,.01,6),0x454a46,x,1.905,z));

  }
  return g;
}
function landmarkModel(o){
  const g=new THREE.Group();
  if(o.type==='npc')return person(o.color);
  if(o.type==='lighthouse'){
    g.add(mesh(new THREE.CylinderGeometry(2.1,3.2,20,12),palette.cream,0,10,0));
    g.add(mesh(new THREE.CylinderGeometry(2.9,2.9,.7,12),0x686f66,0,19.8,0));
    const lantern=mesh(new THREE.CylinderGeometry(1.8,1.8,3.2,10),0xb9d7c7,0,21.7,0);
    lantern.material=lantern.material.clone();g.add(lantern);
    const beacon=new THREE.Group();beacon.position.y=21.7;
    const beam=new THREE.Mesh(new THREE.ConeGeometry(7,90,24,1,true),new THREE.MeshBasicMaterial({color:0xffe6a3,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}));
    beam.rotation.z=Math.PI/2;beam.position.x=45;beacon.add(beam);
    const light=new THREE.PointLight(0xffd98a,65,55,1.5);beacon.add(light);beacon.visible=false;g.add(beacon);
    g.userData={lantern,beacon};
    g.add(cone(3,2.5,0xb1744b,0,24,0,12));
    for(let y=4;y<18;y+=5)g.add(box(.6,1,.15,0x374c48,0,y,2.65-(y/25)));
    g.add(box(1.1,2.3,.2,0x6f5339,0,1.15,3.02));
  }else if(o.type==='cottage'){
    const walls=box(8,5,6,palette.cream,0,2.5,0);walls.material=cottageSurfaces().plaster;g.add(walls,cottageRoof());
    // Raised stone footing, timber corners and recessed-looking framed openings.
    g.add(box(8.3,.45,6.3,0x77796b,0,.22,0));
    for(const x of [-3.92,3.92])for(const z of [-2.96,2.96])g.add(box(.18,4.65,.18,0x69543e,x,2.7,z));
    g.add(box(1.45,2.9,.12,0x4a4234,0,1.85,3.06));
    for(let i=0;i<6;i++){const plank=box(.21,2.7,.08,0x806345,(i-2.5)*.23,1.8,3.15);plank.material=cottageSurfaces().wood;g.add(plank);}
    for(const x of [-.8,.8])g.add(box(.16,3.05,.2,0x69543e,x,1.9,3.12));
    g.add(box(1.76,.18,.2,0x69543e,0,3.43,3.12),box(1.9,.22,.7,0x999783,0,.22,3.36),sphere(.07,0xb9a46c,.48,1.7,3.24));
    for(const x of [-2.4,2.4]){
      g.add(box(1.25,1.4,.12,0x344c4c,x,2.7,3.07));
      for(const dx of [-.7,0,.7])g.add(box(.1,1.62,.16,0x756047,x+dx,2.7,3.17));
      for(const y of [1.9,2.7,3.5])g.add(box(1.5,.1,.18,0x756047,x,y,3.17));
      g.add(box(1.75,.16,.48,0x92816a,x,1.87,3.2));
    }
    for(const z of [-3.08,3.08])g.add(box(8.45,.2,.22,0x69543e,0,4.9,z));
    g.add(box(.85,2.7,.85,0x79776c,2.3,7.1,-.9),box(1.05,.18,1.05,0x53554f,2.3,8.48,-.9));
  }else{
    for(let i=0;i<6;i++){g.add(box(1.6,4+i%3,1.6,0x8d9787,Math.cos(i/3*Math.PI)*5,2,Math.sin(i/3*Math.PI)*5));}g.add(box(2.2,3,.6,0xb5b69b,0,1.5,0));
  }
  return g;
}

export class WorldView{
  constructor(canvas,world){
    this.world=world;this.canvas=canvas;this.yaw=.15;this.pitch=.29;this.distance=14;this.resources=new Map();this.creatures=new Map();this.buildings=new Map();
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xb8d4d5);this.scene.fog=new THREE.Fog(0xb8d4d5,120,470);
    this.camera=new THREE.PerspectiveCamera(55,1,.2,1000);
    this.ambient=new THREE.HemisphereLight(0xe2f1df,0x697346,2.2);this.scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight(0xffe3ad,3);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:240});this.sun.shadow.bias=-.0005;this.scene.add(this.sun,this.sun.target);
    this.rockSurface=initializeRockSurface({anisotropy:this.renderer.capabilities.getMaxAnisotropy()});
    this.createTerrain();this.createWater();this.createScenery();
    this.player=person();this.scene.add(this.player);
    // One nearby fire light keeps the lighting cost bounded as camps grow.
    this.fireLight=new THREE.PointLight(0xffac52,0,18,1.5);this.scene.add(this.fireLight);
    this.marker=new THREE.Mesh(new THREE.RingGeometry(1.8,2,40),new THREE.MeshBasicMaterial({color:0xf2d58f,side:THREE.DoubleSide,transparent:true,opacity:.85}));this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);
    this.preview=new THREE.Group();this.scene.add(this.preview);this.resize();
  }
  createTerrain(){
    const geometry=new THREE.PlaneGeometry(800,800,320,320);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position;
    const colors=[];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i),y=terrain(x,z);positions.setY(i,y);
      const island=[...ISLANDS].sort((a,b)=>Math.hypot(x-a.x,z-a.z)/a.r-Math.hypot(x-b.x,z-b.z)/b.r)[0];
      const slope=Math.hypot(terrain(x+1,z)-terrain(x-1,z),terrain(x,z+1)-terrain(x,z-1));
      const patch=(Math.sin(x*.13+Math.cos(z*.08)*2)+Math.cos(z*.17+x*.035))*.5;
      const grass=new THREE.Color([0x647259,0x476751,0x7d8476,0x8c8965][ISLANDS.indexOf(island)]);
      grass.lerp(new THREE.Color(0x96866b),Math.max(0,patch)*.32);
      const c=grass.lerp(new THREE.Color(palette.sand),Math.max(0,Math.min(1,(3.8-y)/2.8)));
      c.lerp(new THREE.Color(0x8b8b80),Math.max(0,Math.min(.8,(slope-.6)*.65+(y>30?.3:0))));
      c.multiplyScalar(.92+Math.sin(x*.83+z*.71)*.065);colors.push(c.r,c.g,c.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
    const random=randomGenerator(835),pixels=new Uint8Array(256*256*4);
    for(let i=0;i<pixels.length;i+=4){const grain=185+Math.floor(random()*70);pixels[i]=pixels[i+1]=pixels[i+2]=grain;pixels[i+3]=255;}
    const detail=new THREE.DataTexture(pixels,256,256);detail.wrapS=detail.wrapT=THREE.RepeatWrapping;detail.repeat.set(80,80);detail.magFilter=THREE.LinearFilter;detail.minFilter=THREE.LinearMipmapLinearFilter;detail.generateMipmaps=true;detail.needsUpdate=true;
    this.groundSurface=createGroundSurface(detail,{anisotropy:this.renderer.capabilities.getMaxAnisotropy()});
    const ground=new THREE.Mesh(geometry,this.groundSurface);ground.receiveShadow=true;this.scene.add(ground);
  }
  createWater(){
    // Static terrain heights drive shallow-water colour and the foam band.
    const size=256,heights=new Uint8Array(size*size*4);
    for(let z=0;z<size;z++)for(let x=0;x<size;x++){
      const h=terrain((x/(size-1)-.5)*800,(z/(size-1)-.5)*800),i=(z*size+x)*4;
      const encoded=Math.round(THREE.MathUtils.clamp((h+20)/80,0,1)*255);
      heights[i]=heights[i+1]=heights[i+2]=encoded;heights[i+3]=255;
    }
    const depthMap=new THREE.DataTexture(heights,size,size);depthMap.magFilter=depthMap.minFilter=THREE.LinearFilter;depthMap.needsUpdate=true;
    this.waterUniforms={time:{value:0},light:{value:1},terrainMap:{value:depthMap},skyColor:{value:this.scene.fog.color},fogRange:{value:new THREE.Vector2(this.scene.fog.near,this.scene.fog.far)}};
    const waterMaterial=new THREE.ShaderMaterial({uniforms:this.waterUniforms,transparent:true,depthWrite:false,
      vertexShader:`varying vec3 world;uniform float time;
        void main(){vec3 p=position;p.y+=sin(p.x*.13+time*.6)*.10+cos(p.z*.17+time*.8)*.10;
        world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
      fragmentShader:`varying vec3 world;uniform float time;uniform float light;uniform sampler2D terrainMap;uniform vec3 skyColor;uniform vec2 fogRange;
        void main(){
          vec2 uv=world.xz/800.+.5;
          float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
          float floorHeight=mix(-20.,texture2D(terrainMap,uv).r*80.-20.,inside);
          float depth=max(0.,world.y-floorHeight);
          vec3 shallow=vec3(.19,.48,.43),deep=vec3(.035,.18,.24);
          vec3 col=mix(shallow,deep,1.-exp(-depth*.16));
          float ripple=sin(world.x*.8+world.z*.3+time*1.2)*.035;
          vec3 normal=normalize(vec3(-cos(world.x*.13+time*.6)*.013+ripple,1.,sin(world.z*.17+time*.8)*.017+ripple));
          vec3 eye=normalize(cameraPosition-world);
          float fresnel=.025+.58*pow(1.-max(dot(normal,eye),0.),5.);
          col=mix(col,skyColor,fresnel);
          float glint=pow(max(dot(reflect(-normalize(vec3(-.7,1.,.4)),normal),eye),0.),110.);
          float foam=(1.-smoothstep(.1,1.25,depth))*smoothstep(.48,.8,sin(depth*7.-time*1.7+sin(world.x*.6+world.z*.7))*.5+.5);
          col=mix(col,vec3(.77,.86,.77),foam*.65);
          col=col*light+vec3(1.,.84,.61)*glint*light*.45;
          col=mix(col,skyColor,smoothstep(fogRange.x,fogRange.y,length(cameraPosition-world)));
          gl_FragColor=vec4(col,mix(.46,.94,1.-exp(-depth*.35)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
    const geometry=new THREE.PlaneGeometry(1800,1800,140,140);geometry.rotateX(-Math.PI/2);this.water=new THREE.Mesh(geometry,waterMaterial);this.water.position.y=.12;this.scene.add(this.water);
  }
  createScenery(){
    // Shared geometries/materials through instancing keep hundreds of resource nodes inexpensive.
    this.cameraObstacles=this.world.objects.filter(o=>['stone','crystal'].includes(o.type)).map(o=>{
      const radius=(o.type==='stone'?2.8:1.5)*o.scale,height=3.5*o.scale;
      return {object:o,box:new THREE.Box3(new THREE.Vector3(o.x-radius,o.y-.3,o.z-radius),new THREE.Vector3(o.x+radius,o.y+height,o.z+radius))};
    });
    const types=['tree','stone','crystal','berry','fiber','shell'];this.batches=[];
    const dummy=new THREE.Object3D();
    for(const type of types){
      const entries=this.world.objects.filter(o=>o.type===type),model=resourceModel(type);model.updateMatrixWorld(true);
      if(type==='tree'){
        // Separate tree parts leave the open space below the crown available to the camera.
        const bounds=model.children.map(part=>new THREE.Box3().setFromObject(part));
        for(const o of entries){
          dummy.position.set(o.x,o.y,o.z);dummy.scale.setScalar(o.scale);dummy.rotation.set(0,o.rotation,0);dummy.updateMatrix();
          this.cameraObstacles.push({object:o,boxes:bounds.map(box=>box.clone().applyMatrix4(dummy.matrix))});
        }
      }
      mergeStaticParts(model);model.updateMatrixWorld(true);
      for(const part of model.children){
        const batch=new THREE.InstancedMesh(part.geometry,part.material,entries.length);batch.customDepthMaterial=part.customDepthMaterial;batch.castShadow=true;batch.receiveShadow=true;
        for(let i=0;i<entries.length;i++){const o=entries[i];dummy.position.set(o.x,o.y,o.z);dummy.scale.setScalar(o.scale);dummy.rotation.set(0,o.rotation,0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix.clone().multiply(part.matrix));}
        batch.computeBoundingSphere(); // Include all nodes before depletion hides any instance.
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(batch);this.batches.push({batch,entries,part:part.matrix.clone(),hidden:new Set()});
      }
    }
    this.islanders=[];
    for(const o of LANDMARKS){const g=landmarkModel(o);g.position.set(o.x,terrain(o.x,o.z),o.z);if(o.type==='npc'){animateCharacter(g,{x:o.x,z:o.z,yaw:0,time:0,attackAt:-100,selected:'hand'},0,terrain);this.islanders.push({object:o,model:g});}this.scene.add(g);if(o.type==='lighthouse')this.lighthouse=g;}
    const random=randomGenerator(4321);
    this.meadow=createMeadow(random,this.world.objects);this.scene.add(...this.meadow);
    this.sky=createSky();this.scene.add(this.sky);
  }
  updateIslanders(state,near,dt){
    for(const [i,{object:o,model:g}]of this.islanders.entries()){
      const distance=Math.hypot(state.player.x-o.x,state.player.z-o.z);
      const yaw=near?.id===o.id&&distance>.25&&distance<7?Math.atan2(state.player.x-o.x,state.player.z-o.z):g.rotation.y;
      const time=state.time+i*1.7;
      animateCharacter(g,{x:o.x,z:o.z,yaw,time,attackAt:-100,selected:'hand'},dt,terrain);
      // Subtle arm motion leaves the torso and planted feet on their existing ground pose.
      for(let side=0;side<2;side++){
        g.userData.shoulders[side].rotation.z=(side?1:-1)*(.04+Math.sin(time*1.6)*.015);
        g.userData.elbows[side].rotation.x-=Math.sin(time*1.6+side)*.025;
      }
    }
  }
  sync(state){
    const switched=this.syncedState!==state;
    if(switched)this.gatherAt=this.hurtAt=-100;
    const dummy=new THREE.Object3D();
    for(const {batch,entries,part,hidden}of this.batches){let changed=false;entries.forEach((o,i)=>{const depleted=isDepleted(state,o);if(depleted===hidden.has(i))return;depleted?hidden.add(i):hidden.delete(i);dummy.position.set(o.x,o.y,o.z);dummy.scale.setScalar(depleted?0:o.scale);dummy.rotation.set(0,o.rotation,0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix.clone().multiply(part));changed=true;});if(changed)batch.instanceMatrix.needsUpdate=true;}
    const definitions=new Map(state.buildings.map(b=>[b.id,b]));
    for(const [id,g]of this.buildings){const b=definitions.get(id);if(!b||g.userData.buildingType!==b.type){this.scene.remove(g);this.disposeGroup(g);this.buildings.delete(id);}}
    for(const b of state.buildings){if(!this.buildings.has(b.id)){const g=buildingModel(b.type);g.userData.buildingType=b.type;this.scene.add(g);this.buildings.set(b.id,g);}this.buildings.get(b.id).position.set(b.x,terrain(b.x,b.z),b.z);}
    const enemies=new Map(state.enemies.map(e=>[e.id,e]));
    for(const [id,g]of this.creatures){if(!enemies.has(id)||g.userData.type!==enemies.get(id).type){this.scene.remove(g);this.disposeGroup(g);this.creatures.delete(id);}}
    this.creatureGeometryCache??=new Map();
    for(const e of state.enemies){if(!this.creatures.has(e.id)){const g=createCreature(e.type,this.creatureGeometryCache);this.scene.add(g);this.creatures.set(e.id,g);}else if(switched)resetCreature(this.creatures.get(e.id));}
    this.syncedState=state;
  }
  disposeGroup(group){const shared=new Set(materials.values()),released=new Set(),sharedGeometry=group.userData.releaseDistant?.()??new Set();group.traverse(o=>{if(o.isMesh){if(!sharedGeometry.has(o.geometry))o.geometry.dispose();for(const m of [o.material].flat())if(!shared.has(m)&&!released.has(m)){m.dispose();released.add(m);}}});}
  setPreview(type){
    this.disposeGroup(this.preview);this.preview.clear();
    if(!type)return;
    const model=buildingModel(type),shared=new Set(materials.values()),replacements=new Map();
    model.traverse(o=>{if(o.isMesh){
      const original=o.material;
      if(!replacements.has(original)){
        replacements.set(original,new THREE.MeshBasicMaterial({color:0xa6dd9b,transparent:true,opacity:.5,depthWrite:false,side:original.side}));
        if(!shared.has(original))original.dispose();
      }
      o.material=replacements.get(original);
    }});
    this.preview.add(model);
  }
  resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  draw(state,near,placement,moving,dt){
    const p=state.player,h=Math.max(terrain(p.x,p.z),-.45),{daylight}=dayCycle(state.time);
    updateFoliage(state.time);
    updateMeadow(state.time);
    // Skylight rises before direct sunlight; preserve the existing midnight/noon endpoints.
    this.ambient.intensity=.372+Math.sqrt((daylight-.04)/.96)*1.728;
    this.sun.intensity=daylight*2.6;this.waterUniforms.time.value=state.time;this.waterUniforms.light.value=.15+daylight*.85;
    this.scene.background.set(0xb8d4d5).multiplyScalar(.08+daylight*.92);
    let fire=null,fireDistance=30;
    for(const b of state.buildings)if(b.type==='campfire'){const distance=Math.hypot(b.x-p.x,b.z-p.z);if(distance<fireDistance){fire=b;fireDistance=distance;}}
    this.fireLight.intensity=fire?(20+Math.sin(state.time*9)*2+Math.sin(state.time*17))*(1-Math.min(1,Math.max(0,fireDistance-18)/12)):0;
    if(fire)this.fireLight.position.set(fire.x,terrain(fire.x,fire.z)+1.8,fire.z);
    if(this.lighthouse){const {lantern,beacon}=this.lighthouse.userData;const lit=state.quest===6;beacon.visible=lit;beacon.rotation.y=state.time*.3;lantern.material.emissive.set(lit?0xffce72:0x000000);lantern.material.emissiveIntensity=lit?2:0;}
    this.updateIslanders(state,near,dt);
    for(const e of state.enemies){const g=this.creatures.get(e.id);if(g)animateCreature(g,e,state.time,dt,terrain(e.x,e.z),p);}
    this.player.position.set(p.x,h,p.z);
    animateCharacter(this.player,{...p,time:state.time,attackAt:state.attackAt,gatherAt:this.gatherAt,hurtAt:this.hurtAt,selected:state.selected,swimming:terrain(p.x,p.z)<0},dt,terrain);
    const target=new THREE.Vector3(p.x+Math.sin(this.yaw)*this.distance,h+2.4+Math.tan(this.pitch)*this.distance,p.z+Math.cos(this.yaw)*this.distance);
    target.y=Math.max(target.y,terrain(target.x,target.z)+1.5);
    const focus=new THREE.Vector3(p.x,h+2.4,p.z),boxes=this.cameraObstacles.filter(({object:o})=>Math.hypot(o.x-p.x,o.z-p.z)<this.distance+12&&!isDepleted(state,o)).flatMap(o=>o.boxes??[o.box]);
    for(const g of this.buildings.values())if(g.position.distanceTo(focus)<this.distance+12)boxes.push(new THREE.Box3().setFromObject(g));
    for(const o of LANDMARKS)if(['lighthouse','cottage'].includes(o.type)&&Math.hypot(o.x-p.x,o.z-p.z)<this.distance+12){const r=o.type==='lighthouse'?3.2:5,y=terrain(o.x,o.z);boxes.push(new THREE.Box3(new THREE.Vector3(o.x-r,y,o.z-r),new THREE.Vector3(o.x+r,y+(o.type==='lighthouse'?25:9),o.z+r)));}
    const safe=unobstructedCamera(focus,target,boxes,terrain,6),safeYaw=Math.atan2(safe.x-p.x,safe.z-p.z);
    if(Math.abs(Math.atan2(Math.sin(safeYaw-this.yaw),Math.cos(safeYaw-this.yaw)))>.001){
      this.yaw=safeYaw;this.camera.position.copy(safe);
    }else this.camera.position.lerp(safe,1-Math.exp(-dt*8));
    this.camera.position.copy(unobstructedCamera(focus,this.camera.position,boxes,terrain));this.camera.lookAt(focus);
    updateGroundCover(this.meadow,this.camera.position);
    updateSky(this.sky,state.time,this.camera,this.scene.fog);
    this.sun.position.set(p.x-70,h+100,p.z+40);this.sun.target.position.set(p.x,h,p.z);
    this.marker.visible=Boolean(near)&&!placement;if(near)this.marker.position.set(near.x,Math.max(.3,terrain(near.x,near.z))+.08,near.z);
    if(placement){this.preview.visible=true;this.preview.position.set(placement.x,terrain(placement.x,placement.z),placement.z);this.preview.traverse(o=>{if(o.isMesh)o.material.color.set(placement.error?0xe08568:0xa6dd9b);});}else this.preview.visible=false;
    this.renderer.render(this.scene,this.camera);
  }
}
