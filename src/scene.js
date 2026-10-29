import * as THREE from '../vendor/three.module.min.js';
import {terrain,LANDMARKS,randomGenerator,dayCycle,weatherAt} from './world.js';
import {isDepleted,enemyAttackPose} from './game.js';
import {unobstructedCamera,smoothCamera} from './camera.js';
import {resourceHalfSize} from './resource-contact.js';
import {createCharacter,animateCharacter} from './character.js';
import {animateAuthoredCharacter} from './authored-character.js';
import {createImpactFeedback} from './impact-feedback.js';
const animateActor=(model,...args)=>model.userData.authored?animateAuthoredCharacter(model,...args):animateCharacter(model,...args);
import {createTextileMaterial} from './textile.js';
import {createCreature,animateCreature,resetCreature} from './creature.js';
import {mergeStaticParts} from './merge-parts.js';
import {cottageSurfaces,cottageRoof} from './cottage-surfaces.js';
import {updateFoliage} from './foliage.js';
import {createBerryBush} from './berry.js';
import {createTree,TREE_FORMS} from './tree.js';
import {createRuin} from './ruin.js';
import {createLighthouse} from './lighthouse.js';
import {createGroundSurface} from './ground-surface.js';
import {visibleGroundSampler} from './ground-support.js';
import {createWeatheredRock,initializeRockSurface} from './rock.js';
import {createMeadow,createFiberClump,updateMeadow,updateGroundCover,updateCampClearance} from './meadow.js';
import {createSky,updateSky} from './sky.js';
import {createCampBuilding} from './camp-architecture.js';
import {createFlame,updateCampfire} from './campfire.js';
import {createCrystalDeposit} from './crystal.js';
import {landscapeSample,createShoreStones,islandTreeAppearance} from './landscape.js';
import {createContactShade} from './contact-shade.js';

const palette={bark:0x65513d,leaf:0x365a42,lightLeaf:0x68815b,rock:0x858d86,sand:0xd5c8a7,cloth:0xb86636,cream:0xeee1bd};
const nightSkyBounce=new THREE.Color(0xd4e1f5),daySkyBounce=new THREE.Color(0xe2f1df),nightGroundBounce=new THREE.Color(0x8796af),dayGroundBounce=new THREE.Color(0x697346);
const materials=new Map();
function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));return materials.get(color);}
function mesh(geometry,color,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o;}
function box(w,h,d,color,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),color,x,y,z);}
function cone(r,h,color,x=0,y=0,z=0,n=7){return mesh(new THREE.ConeGeometry(r,h,n),color,x,y,z);}
function sphere(r,color,x=0,y=0,z=0){return mesh(new THREE.IcosahedronGeometry(r,0),color,x,y,z);}

function resourceTransform(dummy,o,depleted=false){
  const scale=depleted?0:o.scale,height=o.type==='tree'?islandTreeAppearance(o).height:1;
  const vertical=scale===0?0:o.type==='tree'?Math.max(.95,scale*height):scale;
  dummy.position.set(o.x,o.y,o.z);dummy.scale.set(scale,vertical,scale);dummy.rotation.set(0,o.rotation,0);dummy.updateMatrix();
}

function person(color=palette.cloth){
  return createCharacter(color);
}
function resourceModel(type,treeForm='coast'){
  const g=new THREE.Group();
  if(type==='tree'){
    return createTree(treeForm);
  }else if(type==='stone'){
    const rock=createWeatheredRock(1.8),small=createWeatheredRock(.8);
    rock.position.y=1;rock.scale.set(1.4,.9,1);rock.rotation.z=.3;small.position.set(1.6,.4,1);g.add(rock,small);
  }else if(type==='crystal'){
    return createCrystalDeposit();
  }else if(type==='berry'){
    return createBerryBush();
  }else if(type==='fiber'){
    g.add(createFiberClump());
  }else{const shell=sphere(.6,palette.cream,0,.2,0);shell.scale.y=.35;g.add(shell);}
  return g;
}
export function buildingModel(type,cache=null,options={}){
  if(type==='tent'&&!materials.has('tent-cloth'))materials.set('tent-cloth',createTextileMaterial(0xb9a77c,{side:THREE.DoubleSide,roughness:1}));
  return createCampBuilding(type,cache,{...options,clothMaterial:materials.get('tent-cloth'),ashMaterial:type==='campfire'?material(0x302e28):null});
}
function landmarkModel(o,stoneSurface){
  const g=new THREE.Group();
  if(o.type==='npc')return person(o.color);
  if(o.type==='lighthouse'){
    return createLighthouse();
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
  }else if(o.type==='ruin'){return createRuin(o,terrain,stoneSurface);}
  return g;
}

export class WorldView{
  constructor(canvas,world){
    this.world=world;this.canvas=canvas;this.yaw=.15;this.pitch=.29;this.distance=14;this.resources=new Map();this.creatures=new Map();this.buildings=new Map();this.architectureSurfaceCache=new Map();
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xb8d4d5);this.scene.fog=new THREE.Fog(0xb8d4d5,120,470);
    this.camera=new THREE.PerspectiveCamera(55,1,.2,1000);
    this.ambient=new THREE.HemisphereLight(0xe2f1df,0x697346,2.2);this.scene.add(this.ambient);
    this.nightLight=new THREE.DirectionalLight(0x9aadd4,0);this.scene.add(this.nightLight,this.nightLight.target);
    this.sun=new THREE.DirectionalLight(0xffe3ad,3);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:240});this.sun.shadow.bias=-.0005;this.scene.add(this.sun,this.sun.target);
    this.rockSurface=initializeRockSurface({anisotropy:this.renderer.capabilities.getMaxAnisotropy()});
    this.createTerrain();this.createWater();this.createScenery();
    this.player=person();this.scene.add(this.player);
    this.contactShade=createContactShade(world);this.scene.add(this.contactShade.group);
    this.impacts=createImpactFeedback();this.scene.add(this.impacts.mesh);
    // One nearby fire light keeps the lighting cost bounded as camps grow.
    this.fireLight=new THREE.PointLight(0xffac52,0,18,1.5);this.scene.add(this.fireLight);
    this.marker=new THREE.Mesh(new THREE.RingGeometry(1.8,2,40),new THREE.MeshBasicMaterial({color:0xf2d58f,side:THREE.DoubleSide,transparent:true,opacity:.85}));this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);
    this.preview=new THREE.Group();this.scene.add(this.preview);this.resize();
  }
  installAuthoredCast(cast){
    if(this.authoredCast)throw Error('Authored cast already installed');
    const replacements=[[this.player,cast.actors.traveler],...this.islanders.map(entry=>[entry.model,cast.actors[entry.object.id]])];
    if(replacements.some(([,model])=>!model))throw Error('Incomplete authored cast');
    for(const [old,model]of replacements){model.position.copy(old.position);model.rotation.copy(old.rotation);this.scene.remove(old);this.disposeGroup(old);this.scene.add(model);}
    this.player=cast.actors.traveler;for(const entry of this.islanders)entry.model=cast.actors[entry.object.id];this.authoredCast=cast;
  }
  installWoodlandDressing(dressing){this.woodlandDressing?.release();this.woodlandDressing=dressing;this.scene.add(dressing.root);}
  createTerrain(){
    const geometry=new THREE.PlaneGeometry(800,800,320,320);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position;
    const colors=[],layers=[];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i),y=terrain(x,z);positions.setY(i,y);
      const sample=landscapeSample(x,z);colors.push(...sample.color.toArray());layers.push(sample.rock,sample.litter);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
    geometry.setAttribute('groundLayers',new THREE.Float32BufferAttribute(layers,2));
    this.groundHeight=visibleGroundSampler(geometry);
    const random=randomGenerator(835),pixels=new Uint8Array(256*256*4);
    for(let i=0;i<pixels.length;i+=4){const grain=185+Math.floor(random()*70);pixels[i]=pixels[i+1]=pixels[i+2]=grain;pixels[i+3]=255;}
    const detail=new THREE.DataTexture(pixels,256,256);detail.wrapS=detail.wrapT=THREE.RepeatWrapping;detail.repeat.set(80,80);detail.magFilter=THREE.LinearFilter;detail.minFilter=THREE.LinearMipmapLinearFilter;detail.generateMipmaps=true;detail.needsUpdate=true;
    this.groundSurface=createGroundSurface(detail,{anisotropy:this.renderer.capabilities.getMaxAnisotropy(),landscape:true,rockSurface:this.rockSurface});
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
    this.waterUniforms={time:{value:0},light:{value:1},sunlight:{value:1},windStrength:{value:1},terrainMap:{value:depthMap},skyColor:{value:this.scene.fog.color},fogRange:{value:new THREE.Vector2(this.scene.fog.near,this.scene.fog.far)}};
    const waterMaterial=new THREE.ShaderMaterial({uniforms:this.waterUniforms,transparent:true,depthWrite:false,
      vertexShader:`varying vec3 world;uniform float time,windStrength;
        void main(){vec3 p=position;p.y+=(sin(p.x*.13+time*.6)*.10+cos(p.z*.17+time*.8)*.10)*windStrength;
        world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
      fragmentShader:`varying vec3 world;uniform float time;uniform float light;uniform float sunlight;uniform float windStrength;uniform sampler2D terrainMap;uniform vec3 skyColor;uniform vec2 fogRange;
        void main(){
          vec2 uv=world.xz/800.+.5;
          float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
          float floorHeight=mix(-20.,texture2D(terrainMap,uv).r*80.-20.,inside);
          float depth=max(0.,world.y-floorHeight);
          vec3 shallow=vec3(.19,.48,.43),deep=vec3(.035,.18,.24);
          vec3 col=mix(shallow,deep,1.-exp(-depth*.16));
          float ripple=sin(world.x*.8+world.z*.3+time*1.2)*.035;
          vec3 normal=normalize(vec3((-cos(world.x*.13+time*.6)*.013+ripple)*windStrength,1.,(sin(world.z*.17+time*.8)*.017+ripple)*windStrength));
          vec3 eye=normalize(cameraPosition-world);
          float fresnel=.025+.58*pow(1.-max(dot(normal,eye),0.),5.);
          col=mix(col,skyColor,fresnel);
          float glint=pow(max(dot(reflect(-normalize(vec3(-.7,1.,.4)),normal),eye),0.),110.);
          float foam=(1.-smoothstep(.1,1.25,depth))*smoothstep(.48,.8,sin(depth*7.-time*1.7+sin(world.x*.6+world.z*.7))*.5+.5);
          col=mix(col,vec3(.77,.86,.77),foam*.65);
          col=col*light+vec3(1.,.84,.61)*glint*sunlight*.45;
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
      const radius=resourceHalfSize(o),height=3.5*o.scale;
      return {object:o,box:new THREE.Box3(new THREE.Vector3(o.x-radius,o.y-.3,o.z-radius),new THREE.Vector3(o.x+radius,o.y+height,o.z+radius))};
    });
    const types=['tree','stone','crystal','berry','fiber','shell'];this.batches=[];
    const dummy=new THREE.Object3D();
    for(const type of types){
      for(const form of type==='tree'?TREE_FORMS:[null]){
      const entries=this.world.objects.filter(o=>o.type===type&&(type!=='tree'||islandTreeAppearance(o).form===form)),model=resourceModel(type,form);model.updateMatrixWorld(true);
      if(type==='tree'){
        // Separate tree parts leave the open space below the crown available to the camera.
        const bounds=model.children.map(part=>new THREE.Box3().setFromObject(part));
        for(const o of entries){
          resourceTransform(dummy,o);
          this.cameraObstacles.push({object:o,boxes:bounds.map(box=>box.clone().applyMatrix4(dummy.matrix))});
        }
      }
      mergeStaticParts(model);model.updateMatrixWorld(true);
      for(const part of model.children){
        const batch=new THREE.InstancedMesh(part.geometry,part.material,entries.length);batch.customDepthMaterial=part.customDepthMaterial;batch.castShadow=true;batch.receiveShadow=true;
        if(type==='tree')batch.userData.treeForm=form;
        for(let i=0;i<entries.length;i++){const o=entries[i];resourceTransform(dummy,o);batch.setMatrixAt(i,dummy.matrix.clone().multiply(part.matrix));if(type==='tree'&&part.material.alphaTest>0)batch.setColorAt(i,islandTreeAppearance(o).tint);}
        batch.computeBoundingSphere(); // Include all nodes before depletion hides any instance.
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(batch);this.batches.push({batch,entries,part:part.matrix.clone(),hidden:new Set()});
      }
      }
    }
    this.islanders=[];
    for(const o of LANDMARKS){const g=landmarkModel(o,this.rockSurface);g.position.set(o.x,terrain(o.x,o.z),o.z);if(o.type==='ruin')this.cameraObstacles.push({object:o,boxes:g.userData.cameraBoxes.map(box=>box.clone().translate(g.position))});if(o.type==='npc'){animateCharacter(g,{x:o.x,z:o.z,yaw:0,time:0,attackAt:-100,selected:'hand'},0,terrain);this.islanders.push({object:o,model:g});}this.scene.add(g);if(o.type==='lighthouse')this.lighthouse=g;}
    const random=randomGenerator(4321);
    this.meadow=[...createMeadow(random,this.world.objects,this.groundHeight),...createShoreStones()];this.scene.add(...this.meadow);
    this.sky=createSky();this.scene.add(this.sky);
  }
  updateIslanders(state,near,dt){
    for(const [i,{object:o,model:g}]of this.islanders.entries()){
      const distance=Math.hypot(state.player.x-o.x,state.player.z-o.z);
      const yaw=near?.id===o.id&&distance>.25&&distance<7?Math.atan2(state.player.x-o.x,state.player.z-o.z):g.rotation.y;
      const time=state.time+i*1.7;
      animateActor(g,{x:o.x,z:o.z,yaw,time,attackAt:-100,selected:'hand'},dt,terrain);
      // Subtle arm motion leaves the torso and planted feet on their existing ground pose.
      if(g.userData.authored)continue;
      for(let side=0;side<2;side++){
        g.userData.shoulders[side].rotation.z=(side?1:-1)*(.04+Math.sin(time*1.6)*.015);
        g.userData.elbows[side].rotation.x-=Math.sin(time*1.6+side)*.025;
      }
    }
  }
  sync(state){
    const switched=this.syncedState!==state;
    if(switched){this.gatherAt=this.hurtAt=-100;this.gatherKind=this.gatherTool=this.gatherTarget=null;this.impacts?.clear();}
    const dummy=new THREE.Object3D();
    for(const {batch,entries,part,hidden}of this.batches){let changed=false;entries.forEach((o,i)=>{const depleted=isDepleted(state,o);if(depleted===hidden.has(i))return;depleted?hidden.add(i):hidden.delete(i);resourceTransform(dummy,o,depleted);batch.setMatrixAt(i,dummy.matrix.clone().multiply(part));changed=true;});if(changed)batch.instanceMatrix.needsUpdate=true;}
    const definitions=new Map(state.buildings.map(b=>[b.id,b]));
    for(const [id,g]of this.buildings){const b=definitions.get(id);if(!b||g.userData.buildingType!==b.type){this.scene.remove(g);this.disposeGroup(g);this.buildings.delete(id);}}
    for(const b of state.buildings){if(!this.buildings.has(b.id)){const g=buildingModel(b.type,this.architectureSurfaceCache);g.updateMatrixWorld(true);mergeStaticParts(g);g.userData.buildingType=b.type;this.scene.add(g);this.buildings.set(b.id,g);}this.buildings.get(b.id).position.set(b.x,terrain(b.x,b.z),b.z);}
    updateCampClearance(this.meadow??[],state.buildings);
    const enemies=new Map(state.enemies.map(e=>[e.id,e]));
    for(const [id,g]of this.creatures){if(!enemies.has(id)||g.userData.type!==enemies.get(id).type){this.scene.remove(g);this.disposeGroup(g);this.creatures.delete(id);}}
    this.creatureGeometryCache??=new Map();
    for(const e of state.enemies){if(!this.creatures.has(e.id)){const g=createCreature(e.type,this.creatureGeometryCache);this.scene.add(g);this.creatures.set(e.id,g);}else if(switched)resetCreature(this.creatures.get(e.id));}
    this.syncedState=state;
    this.contactShade?.sync(state);
    this.inland?.afterSync(state);
  }
  disposeGroup(group){const shared=new Set(materials.values()),released=new Set(),sharedGeometry=group.userData.releaseDistant?.()??new Set();group.userData.releaseSurface?.();group.traverse(o=>{if(o.isMesh){if(!sharedGeometry.has(o.geometry))o.geometry.dispose();for(const m of [o.material].flat())if(!shared.has(m)&&!released.has(m)){m.dispose();released.add(m);}}});}
  setPreview(type){
    this.disposeGroup(this.preview);this.preview.clear();
    if(!type)return;
    const model=buildingModel(type,null,{surfaces:false}),shared=new Set(materials.values()),replacements=new Map();
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
  resize(){
    const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);
    // Bound fragment work at1080p while retaining the existing mobile detail ceiling.
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5,Math.sqrt(1920*1080/(w*h))));
    this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  }
  updateAtmosphere(time,weather=weatherAt(time)){
    const {daylight}=dayCycle(time);
    const bounceDay=THREE.MathUtils.smoothstep(daylight,.04,.65);
    this.ambient.color.copy(daySkyBounce).lerp(nightSkyBounce,1-bounceDay);
    if(this.ambient.groundColor)this.ambient.groundColor.copy(dayGroundBounce).lerp(nightGroundBounce,1-bounceDay);
    this.ambient.intensity=(.6+Math.sqrt((daylight-.04)/.96)*1.5+.3*(1-bounceDay))*weather.skylight;
    this.sun.intensity=daylight*2.6*weather.sunlight;
    if(this.nightLight)this.nightLight.intensity=.7*(1-THREE.MathUtils.smoothstep(daylight,.12,.65))*weather.skylight;
    this.scene.fog.near=weather.fogNear;this.scene.fog.far=weather.fogFar;
    updateSky(this.sky,time,this.camera,this.scene.fog,weather);
    this.scene.background.copy(this.scene.fog.color);
    this.waterUniforms.time.value=time;this.waterUniforms.light.value=(.15+daylight*.85)*weather.skylight;
    this.waterUniforms.sunlight.value=daylight*weather.sunlight;
    this.waterUniforms.windStrength.value=weather.windStrength;
    this.waterUniforms.fogRange.value.set(weather.fogNear,weather.fogFar);
  }
  draw(state,near,placement,moving,dt){
    this.coastal?.update(state);
    this.inland?.update(state);
    const p=state.player,h=Math.max(terrain(p.x,p.z),-.45),weather=weatherAt(state.time);
    updateFoliage(state.time,weather.windStrength);
    updateMeadow(state.time,weather.windStrength);
    this.woodlandDressing?.update(state,weather.windStrength);
    let fire=null,fireDistance=30;
    for(const b of state.buildings)if(b.type==='campfire'){const model=this.buildings.get(b.id);if(model)updateCampfire(model,state.time);const distance=Math.hypot(b.x-p.x,b.z-p.z);if(distance<fireDistance){fire=b;fireDistance=distance;}}
    this.fireLight.intensity=fire?(20+Math.sin(state.time*9)*2+Math.sin(state.time*17))*(1-Math.min(1,Math.max(0,fireDistance-18)/12)):0;
    if(fire)this.fireLight.position.set(fire.x,terrain(fire.x,fire.z)+1.8,fire.z);
    if(this.lighthouse){const {lantern,beacon}=this.lighthouse.userData;const lit=state.quest===6;beacon.visible=lit;beacon.rotation.y=state.time*.3;lantern.material.emissive.set(lit?0xffce72:0x000000);lantern.material.emissiveIntensity=lit?2:0;}
    this.updateIslanders(state,near,dt);
    for(const e of state.enemies){const g=this.creatures.get(e.id);if(g)animateCreature(g,e,state.time,dt,terrain(e.x,e.z),p,enemyAttackPose(state,e),terrain);}
    this.player.position.set(p.x,h,p.z);
    animateActor(this.player,{...p,time:state.time,attackAt:state.attackAt,gatherAt:this.gatherAt,gatherKind:this.gatherKind,gatherTarget:this.gatherTarget,gatherTool:this.gatherTool??state.selected,hurtAt:this.hurtAt,selected:state.selected,swimming:terrain(p.x,p.z)<0},dt,terrain);
    this.contactShade?.updateActors(this.player,this.islanders,this.creatures);
    this.impacts?.update(state.time);
    const target=new THREE.Vector3(p.x+Math.sin(this.yaw)*this.distance,h+2.4+Math.tan(this.pitch)*this.distance,p.z+Math.cos(this.yaw)*this.distance);
    target.y=Math.max(target.y,terrain(target.x,target.z)+1.5);
    const focus=new THREE.Vector3(p.x,h+2.4,p.z),boxes=this.cameraObstacles.filter(({object:o})=>Math.hypot(o.x-p.x,o.z-p.z)<this.distance+12&&!isDepleted(state,o)).flatMap(o=>o.boxes??[o.box]);
    for(const g of this.buildings.values())if(g.position.distanceTo(focus)<this.distance+12)boxes.push(new THREE.Box3().setFromObject(g));
    for(const o of LANDMARKS)if(['lighthouse','cottage'].includes(o.type)&&Math.hypot(o.x-p.x,o.z-p.z)<this.distance+12){const r=o.type==='lighthouse'?3.2:5,y=terrain(o.x,o.z);boxes.push(new THREE.Box3(new THREE.Vector3(o.x-r,y,o.z-r),new THREE.Vector3(o.x+r,y+(o.type==='lighthouse'?25:9),o.z+r)));}
    // Avoidance may move the rendered camera; retain the player's requested orbit for the next gesture.
    const renderedYaw=Math.atan2(this.camera.position.x-p.x,this.camera.position.z-p.z);
    const safe=unobstructedCamera(focus,target,boxes,terrain,6,renderedYaw);
    this.camera.position.copy(smoothCamera(focus,this.camera.position,safe,boxes,terrain,dt,Math.min(6,safe.distanceTo(focus))));this.camera.lookAt(focus);
    updateGroundCover(this.meadow,this.camera.position);
    this.updateAtmosphere(state.time,weather);
    this.sun.position.set(p.x-70,h+100,p.z+40);this.sun.target.position.set(p.x,h,p.z);
    if(this.nightLight){this.nightLight.position.set(p.x+70,h+90,p.z-40);this.nightLight.target.position.set(p.x,h,p.z);}
    this.marker.visible=Boolean(near)&&!placement;if(near)this.marker.position.set(near.x,Math.max(.3,terrain(near.x,near.z))+.08,near.z);
    if(placement){this.preview.visible=true;this.preview.position.set(placement.x,terrain(placement.x,placement.z),placement.z);this.preview.traverse(o=>{if(o.isMesh)o.material.color.set(placement.error?0xe08568:0xa6dd9b);});}else this.preview.visible=false;
    this.renderer.render(this.scene,this.camera);
  }
}
