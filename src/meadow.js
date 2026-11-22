import * as THREE from '../vendor/three.module.min.js';
import {terrain,layoutTerrain,LANDMARKS,SPAWN,ISLANDS,randomGenerator} from './world.js';
import {landscapeMass} from './landscape.js';
import {seatMeadowRoots} from './ground-support.js';
import {estuaryHabitat} from './estuary-habitat.js';
import {highlandAscent} from './highland-ascent.js';
import {shoalHabitat,shoalInterior} from './shoal-habitat.js';
import {settlementBankAt,settlementWearAt} from './settlement-ground.js';
import {createCanopy} from './foliage.js';

const windTime={value:0};
const windStrength={value:1};
let surface,depthSurface,coverSurface;
export function updateMeadow(time,strength=1){windTime.value=time;windStrength.value=Number.isFinite(strength)?THREE.MathUtils.clamp(strength,0,1):1;}

function meadowWind(shader){
    shader.uniforms.meadowTime=windTime;
    shader.uniforms.meadowWindStrength=windStrength;
    shader.vertexShader='uniform float meadowTime,meadowWindStrength;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 meadowWorld=vec4(position,1.0);
      #ifdef USE_INSTANCING
        meadowWorld=instanceMatrix*meadowWorld;
      #endif
      meadowWorld=modelMatrix*meadowWorld;
      float bend=pow(clamp(position.y/.65,0.0,1.0),2.0);
      float gust=sin(meadowTime*1.2+meadowWorld.x*.11+meadowWorld.z*.13);
      vec3 sway=vec3(gust*.09,0.0,sin(meadowTime*1.1+meadowWorld.x*.09)*.06)*bend*meadowWindStrength;
      #ifdef USE_INSTANCING
        // Meadow instances use equal X/Z scale; rotate the wind into local coordinates.
        transformed.x+=dot(normalize(instanceMatrix[0].xyz),sway);
        transformed.z+=dot(normalize(instanceMatrix[2].xyz),sway);
      #else
        transformed+=sway;
      #endif
    `);
}

function meadowSurface(){
  if(surface)return surface;
  surface=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,side:THREE.DoubleSide});
  depthSurface=new THREE.MeshDepthMaterial({side:THREE.DoubleSide,depthPacking:THREE.RGBADepthPacking});
  for(const material of [surface,depthSurface]){material.onBeforeCompile=meadowWind;material.customProgramCacheKey=()=> 'tidelands-meadow-wind-v2';}
  return surface;
}

function groundCoverSurface(){
  if(coverSurface)return coverSurface;
  coverSurface=meadowSurface().clone();
  coverSurface.onBeforeCompile=shader=>{
    meadowWind(shader);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      float coverFade=1.-smoothstep(50.,80.,length(cameraPosition.xz-meadowWorld.xz));
      transformed.y*=coverFade;
      #include <project_vertex>`);
  };
  coverSurface.customProgramCacheKey=()=> 'tidelands-ground-cover-wind-v2';return coverSurface;
}

export function updateGroundCover(batches,camera){
  for(const batch of batches){
    if(!['meadow-cover','meadow-shore','meadow-fern','highland-heath','shoal-dune'].includes(batch.name))continue;
    const box=batch.boundingBox,dx=Math.max(box.min.x-camera.x,0,camera.x-box.max.x),dz=Math.max(box.min.z-camera.z,0,camera.z-box.max.z);
    batch.visible=batch.userData.detailEnabled!==false&&dx*dx+dz*dz<80*80;
  }
}

const campFootprints={tent:[2.15,1.85],workbench:[1.65,1.2],campfire:[1.4,1.4]};
const landscapeNames=new Set(['meadow-grass','meadow-flowers','meadow-cover','meadow-shore','meadow-fern','shore-stones','highland-heath','highland-scree','shoal-dune','shoal-scrub']);
export function updateCampClearance(batches,buildings,scenery=[]){
  const footprints=[...buildings.filter(b=>campFootprints[b.type]).map(b=>[b.x,b.z,...campFootprints[b.type]]),...scenery],key=JSON.stringify(footprints);
  let changed=0;
  for(const batch of batches){
    if(!landscapeNames.has(batch.name)||batch.userData.campKey===key)continue;
    const hidden=batch.userData.campHidden??=new Map(),data=batch.instanceMatrix.array;
    const bounds=batch.boundingBox,candidates=footprints.filter(([x,z,w,d])=>x+w>=bounds.min.x&&x-w<=bounds.max.x&&z+d>=bounds.min.z&&z-d<=bounds.max.z);
    if(!candidates.length){
      if(hidden.size){for(const [i,original]of hidden){data.set(original,i*16);changed++;}hidden.clear();batch.instanceMatrix.needsUpdate=true;}
      batch.userData.campKey=key;continue;
    }
    const box=batch.geometry.boundingBox,radius=Math.hypot(Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),Math.max(Math.abs(box.min.z),Math.abs(box.max.z)));
    let dirty=false;
    for(let i=0;i<batch.count;i++){
      const offset=i*16,original=hidden.get(i)??data.subarray(offset,offset+16),x=original[12],z=original[14];
      const padding=radius*Math.max(Math.hypot(original[0],original[1],original[2]),Math.hypot(original[8],original[9],original[10]))+.1;
      const occupied=candidates.some(([cx,cz,w,d])=>Math.abs(x-cx)<=w+padding&&Math.abs(z-cz)<=d+padding);
      if(occupied&&!hidden.has(i)){
        hidden.set(i,original.slice());
        // Keep a nonsingular wind basis; zero scales would normalize a zero shader vector.
        data[offset+13]=-10000;dirty=true;changed++;
      }else if(!occupied&&hidden.has(i)){data.set(original,offset);hidden.delete(i);dirty=true;changed++;}
    }
    if(dirty)batch.instanceMatrix.needsUpdate=true;
    batch.userData.campKey=key;
  }
  return changed;
}

function geometryBuilder(){
  const positions=[],colors=[],indices=[];
  return {
    vertex(point,color){const i=positions.length/3;positions.push(...point);colors.push(color.r,color.g,color.b);return i;},
    triangle(a,b,c){indices.push(a,b,c);},
    finish(){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(.12);
      geometry.computeBoundingSphere();geometry.boundingSphere.radius+=.12;
      return geometry;
    }
  };
}

function ribbon(builder,points,widths,angle,root,tip){
  const rows=points.map((point,i)=>{
    const color=root.clone().lerp(tip,i/(points.length-1));
    if(i===points.length-1)return [builder.vertex(point,color)];
    const dx=Math.cos(angle+i*.10)*widths[i]/2,dz=Math.sin(angle+i*.10)*widths[i]/2;
    return [builder.vertex([point[0]-dx,point[1],point[2]-dz],color),builder.vertex([point[0]+dx,point[1],point[2]+dz],color)];
  });
  for(let i=0;i<rows.length-1;i++){
    builder.triangle(rows[i][0],rows[i][1],rows[i+1][0]);
    if(rows[i+1].length===2)builder.triangle(rows[i][1],rows[i+1][1],rows[i+1][0]);
  }
}

export function createGrassClump(){
  const builder=geometryBuilder(),random=randomGenerator(6147);
  for(let i=0;i<5;i++){
    const angle=i*2.399+random()*.5,r=.05+random()*.13,height=.35+random()*.3,lean=.12+random()*.19,width=.035+random()*.025;
    const x=Math.cos(angle)*r,z=Math.sin(angle)*r,points=[0,.42,.76,1].map(t=>[x+Math.sin(angle)*lean*t*t,height*t,z+Math.cos(angle)*lean*t*t]);
    ribbon(builder,points,[width*.5,width,width*.55,0],angle,new THREE.Color(0x405731).multiplyScalar(.8+random()*.2),new THREE.Color(0x829b52));
  }
  const mesh=new THREE.Mesh(builder.finish(),meadowSurface());mesh.receiveShadow=true;return mesh;
}

export function createWildflower(){
  const builder=geometryBuilder(),root=new THREE.Color(0x4d653b),tip=new THREE.Color(0x869456);
  const stem=[[0,0,0],[.015,.22,.005],[.04,.43,.01],[.055,.57,.015]];
  for(const angle of [0,Math.PI/2])ribbon(builder,stem,[.012,.012,.009,0],angle,root,tip);
  for(const sign of [-1,1])ribbon(builder,[[.015,.20,0],[sign*.09,.30,.025],[sign*.17,.33,.04]],[.008,.07,0],Math.PI/2,root,tip);
  const petalRoot=new THREE.Color(0xb8a969),petalTip=new THREE.Color(0xeee6c7),head=stem.at(-1);
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5,radial=[Math.cos(angle),Math.sin(angle)],side=[-radial[1],radial[0]];
    const point=(r,s,y)=>[head[0]+radial[0]*r+side[0]*s,head[1]+y,head[2]+radial[1]*r+side[1]*s];
    const center=builder.vertex(point(.08,0,.012),petalTip);
    const edge=[[.025,0,0],[.09,-.045,.018],[.16,0,.03],[.09,.045,.018]].map(([r,s,y],j)=>builder.vertex(point(r,s,y),j===0?petalRoot:petalTip));
    for(let j=0;j<4;j++)builder.triangle(center,edge[j],edge[(j+1)%4]);
  }
  const pollen=new THREE.Color(0xd9ab48),center=builder.vertex([head[0],head[1]+.014,head[2]],pollen),ring=[];
  for(let i=0;i<8;i++)ring.push(builder.vertex([head[0]+Math.cos(i*Math.PI/4)*.036,head[1]+.01,head[2]+Math.sin(i*Math.PI/4)*.036],pollen));
  for(let i=0;i<8;i++)builder.triangle(center,ring[i],ring[(i+1)%8]);
  const mesh=new THREE.Mesh(builder.finish(),meadowSurface());mesh.receiveShadow=true;return mesh;
}

function createDuneClump(){
  const builder=geometryBuilder(),random=randomGenerator(8239),root=new THREE.Color(0x696943),tip=new THREE.Color(0xb2aa74);
  for(let i=0;i<7;i++){
    const angle=i*2.399,reach=.3+random()*.35,height=.28+random()*.26;
    const points=[0,.35,.7,1].map(t=>[Math.sin(angle)*reach*t*t,height*Math.sin(t*1.8),Math.cos(angle)*reach*t*t]);
    ribbon(builder,points,[.014,.045,.028,0],angle,root,tip);
  }
  const mesh=new THREE.Mesh(builder.finish(),groundCoverSurface());mesh.receiveShadow=true;return mesh;
}

export function createFernClump(){
  const builder=geometryBuilder(),random=randomGenerator(7843),root=new THREE.Color(0x314b34),tip=new THREE.Color(0x73874b);
  for(let frond=0;frond<6;frond++){
    const angle=frond*2.399+random()*.2,reach=.55+random()*.22,height=.43+random()*.2;
    const point=t=>[Math.sin(angle)*reach*t*t,height*Math.sin(t*1.9),Math.cos(angle)*reach*t*t];
    ribbon(builder,[0,.2,.4,.6,.8,1].map(point),[.014,.017,.015,.012,.008,0],angle,root,tip);
    for(let pair=0;pair<5;pair++){
      const t=.23+pair*.135,base=point(t),length=.19*Math.sin(t*Math.PI)+.025;
      for(const side of [-1,1]){
        const x=Math.cos(angle)*side,z=-Math.sin(angle)*side;
        const leaf=[base,[base[0]+x*length*.55+Math.sin(angle)*.025,base[1]+.035,base[2]+z*length*.55+Math.cos(angle)*.025],[base[0]+x*length+Math.sin(angle)*.075,base[1]+.025,base[2]+z*length+Math.cos(angle)*.075]];
        ribbon(builder,leaf,[.01,.075*(1-t*.5),0],angle,root,tip);
      }
    }
  }
  const mesh=new THREE.Mesh(builder.finish(),groundCoverSurface());mesh.receiveShadow=true;return mesh;
}

export function createFiberClump(){
  const builder=geometryBuilder(),root=new THREE.Color(0x62663d),leafTip=new THREE.Color(0xaaa971),seedRoot=new THREE.Color(0x9a8054),seedTip=new THREE.Color(0xc9b382);
  for(let i=0;i<5;i++){
    const x=(i-2)*.2,z=Math.sin(i)*.3,height=1.1+(i%3)*.13,lean=(i-2)*.05,angle=i*2.399;
    const stem=[0,.4,.75,1].map(t=>[x+lean*t*t,height*t,z+.07*t*t]);
    for(const side of [0,Math.PI/2])ribbon(builder,stem,[.018,.014,.011,0],side,root,leafTip);
    for(const sign of [-1,1])ribbon(builder,[[x+lean*.15,height*.35,z],[x+sign*.13,height*.6,z+.09],[x+sign*.25,height*.66,z+.14]],[.01,.065,0],angle,root,leafTip);
    const head=stem.at(-1);
    for(let j=0;j<3;j++){
      const a=angle+j*Math.PI/3;
      ribbon(builder,[[head[0],head[1]-.20,head[2]],[head[0],head[1]-.08,head[2]],[head[0]+lean*.15,head[1]+.05,head[2]+.01],[head[0]+lean*.25,head[1]+.12,head[2]+.02]],[.035,.10,.07,0],a,seedRoot,seedTip);
    }
  }
  const mesh=new THREE.Mesh(builder.finish(),meadowSurface());mesh.customDepthMaterial=depthSurface;mesh.castShadow=mesh.receiveShadow=true;return mesh;
}

// Keep the existing placements, but cull regions instead of submitting the whole archipelago.
function regionBatches(model,matrices,name,regionSize=128,colors=[],groundHeight=null){
  // Preserve the seeded placements while shortening plants along the worn tread.
  if(name!=='meadow-shore'&&name!=='highland-heath'){
    const heightScale=new THREE.Vector3(1,1,1);
    for(const matrix of matrices){
      const a=matrix.elements,wear=highlandAscent(a[12],a[14],a[13])?.wear??0;
      if(wear>0){heightScale.y=1-wear*.86;matrix.scale(heightScale);}
    }
  }
  if(groundHeight)seatMeadowRoots(model.geometry,matrices,groundHeight);
  const regions=new Map();
  matrices.forEach((matrix,i)=>{const key=`${Math.floor(matrix.elements[12]/regionSize)},${Math.floor(matrix.elements[14]/regionSize)}`;if(!regions.has(key))regions.set(key,[]);regions.get(key).push({matrix,color:colors[i]});});
  return [...regions.values()].map(entries=>{
    const batch=new THREE.InstancedMesh(model.geometry,model.material,entries.length);batch.name=name;batch.receiveShadow=true;
    entries.forEach(({matrix,color},i)=>{batch.setMatrixAt(i,matrix);if(color)batch.setColorAt(i,color);});batch.computeBoundingBox();batch.computeBoundingSphere();return batch;
  });
}

function pathDistance(x,z,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
}

// A separate seed leaves existing scenery and cloud random draws unchanged.
function createGroundCover(groundHeight){
  const random=randomGenerator(19541),dummy=new THREE.Object3D(),matrices=[],colors=[],keeper=LANDMARKS.find(o=>o.id==='keeper'),cottage=LANDMARKS.find(o=>o.id==='cottage');
  for(let patch=0;patch<850;patch++){
    const cx=random()*590-295,cz=random()*650-325,radius=3+random()*4;
    if(layoutTerrain(cx,cz)<3.5||layoutTerrain(cx,cz)>30)continue;
    const tone=new THREE.Color().setRGB(.78+random()*.22,.82+random()*.18,.68+random()*.2);
    for(let i=0;i<600;i++){
      const angle=random()*Math.PI*2,r=Math.pow(random(),.65)*radius,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r,y=layoutTerrain(x,z);
      if(random()<Math.pow(r/radius,3))continue;
      const slope=Math.hypot(layoutTerrain(x+.5,z)-layoutTerrain(x-.5,z),layoutTerrain(x,z+.5)-layoutTerrain(x,z-.5));
      if(y<3.5||y>30||slope>.55||LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<(o.id==='cottage'?8:6))||pathDistance(x,z,SPAWN,keeper)<1.7||pathDistance(x,z,keeper,cottage)<1.7)continue;
      const scale=.5+random()*.65;
      dummy.position.set(x,terrain(x,z)-.04,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.set(scale,scale*(.7+random()*.6),scale);dummy.updateMatrix();
      const color=tone.clone().multiplyScalar(.85+random()*.15),currentHeight=terrain(x,z);
      // Consume the original draws before clipping new steep ground, preserving distant patches.
      if(currentHeight<3.5||currentHeight>30||Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5))>.55)continue;
      matrices.push(dummy.matrix.clone());colors.push(color);
    }
  }
  const model=createGrassClump();model.material=groundCoverSurface();
  return regionBatches(model,matrices,'meadow-cover',32,colors,groundHeight);
}

// Sparse salt-tolerant tufts above the wave band, independent of inland placement RNG.
function createShoreCover(groundHeight,highland,shoal){
  const random=randomGenerator(26081),dummy=new THREE.Object3D(),matrices=[],colors=[];
  for(let patch=0;patch<2400;patch++){
    const cx=random()*590-295,cz=random()*650-325,radius=1.5+random()*2.5;
    if(layoutTerrain(cx,cz)<.55||layoutTerrain(cx,cz)>2.4)continue;
    const tone=new THREE.Color().setRGB(.85+random()*.15,.85+random()*.15,.78+random()*.16);
    for(let i=0;i<24;i++){
      const angle=random()*Math.PI*2,r=Math.sqrt(random())*radius,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r,y=layoutTerrain(x,z);
      const slope=Math.hypot(layoutTerrain(x+.5,z)-layoutTerrain(x-.5,z),layoutTerrain(x,z+.5)-layoutTerrain(x,z-.5));
      if(y<.55||y>2.4||slope>.45||random()<r/radius*.5||LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<8))continue;
      const scale=.65+random()*.65;
      dummy.position.set(x,terrain(x,z)-.04,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.set(scale,scale*(.7+random()*.4),scale);dummy.updateMatrix();
      // Layout RNG stays stable; the drawn Float32 position must still sit on safe coastal ground.
      const px=Math.fround(x),pz=Math.fround(z),height=terrain(px,pz),currentSlope=Math.hypot(terrain(px+.5,pz)-terrain(px-.5,pz),terrain(px,pz+.5)-terrain(px,pz-.5));
      if(height<.55||height>2.4||currentSlope>.45)continue;
      dummy.position.y=height-.04;dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());colors.push(tone);
    }
  }
  // Fill the sheltered pockets using the same material and batch type as the shore.
  const reedColor=new THREE.Color(0xc1b37a);
  for(let x=18;x<=150;x+=.9)for(let z=-55;z<=49;z+=.9){
    const px=x+(random()-.5)*.85,pz=z+(random()-.5)*.85;
    const height=terrain(px,pz);
    if(height<.6||height>2.6)continue;
    const slope=Math.hypot(terrain(px+.5,pz)-terrain(px-.5,pz),terrain(px,pz+.5)-terrain(px,pz-.5));
    const reed=estuaryHabitat(px,pz,height,slope)?.reed??0;
    if(reed<.28||random()>.74*reed)continue;
    const scale=.8+random()*.55;
    dummy.position.set(px,height-.04,pz);dummy.rotation.set(0,random()*Math.PI*2,0);
    dummy.scale.set(scale,scale*(1.13+reed*.42),scale);dummy.updateMatrix();
    matrices.push(dummy.matrix.clone());colors.push(reedColor.clone().multiplyScalar(.84+random()*.16));
  }
  const heath=randomGenerator(53128),heathTone=new THREE.Color(0xb4b18b),heathMatrices=[],heathColors=[];
  if(highland)for(let x=-102;x<=-53;x+=1.15)for(let z=-198;z<=-146;z+=1.15){
    const px=x+(heath()-.5),pz=z+(heath()-.5),height=terrain(px,pz);
    const slope=Math.hypot(terrain(px+.5,pz)-terrain(px-.5,pz),terrain(px,pz+.5)-terrain(px,pz-.5));
    const ascent=highlandAscent(px,pz,height,slope);
    if(!ascent||ascent.wear>.22||ascent.plants<.45||heath()>.8*ascent.plants)continue;
    const scale=.85+heath()*.77;
    dummy.position.set(px,height-.04,pz);dummy.rotation.set(0,heath()*Math.PI*2,0);
    dummy.scale.set(scale,scale*.58,scale);dummy.updateMatrix();
    heathMatrices.push(dummy.matrix.clone());heathColors.push(heathTone.clone().multiplyScalar(.8+heath()*.23));
  }
  const duneRandom=randomGenerator(29017),duneTint=new THREE.Color(0xc3b482),duneMatrices=[],duneColors=[];
  if(shoal)for(let x=68;x<=142;x+=1.65)for(let z=126;z<=180;z+=1.65){
    const px=x+(duneRandom()-.5)*1.3,pz=z+(duneRandom()-.5)*1.3,height=terrain(px,pz);
    const slope=Math.hypot(terrain(px+.5,pz)-terrain(px-.5,pz),terrain(px,pz+.5)-terrain(px,pz-.5));
    const dune=shoalHabitat(px,pz,height,slope)?.dune??0;
    if(dune<.52||duneRandom()>.67*dune)continue;
    const scale=.95+duneRandom()*.68;
    dummy.position.set(px,height-.04,pz);dummy.rotation.set(0,duneRandom()*Math.PI*2,0);
    dummy.scale.set(scale,scale*(1.08+dune*.42),scale);dummy.updateMatrix();
    duneMatrices.push(dummy.matrix.clone());duneColors.push(duneTint.clone().multiplyScalar(.83+duneRandom()*.17));
  }
  const model=createDuneClump();
  return [...regionBatches(model,matrices,'meadow-shore',32,colors,groundHeight),
    ...regionBatches(model,heathMatrices,'highland-heath',32,heathColors,groundHeight),
    ...regionBatches(model,duneMatrices,'shoal-dune',64,duneColors,groundHeight)];
}

// A tree's shelter defines a small community, leaving open routes and exposed slopes clear.
export function createForestCover(objects,groundHeight){
  const random=randomGenerator(48271),dummy=new THREE.Object3D(),matrices=[],colors=[],occupied=new Map();
  const keeper=LANDMARKS.find(o=>o.id==='keeper'),cottage=LANDMARKS.find(o=>o.id==='cottage');
  for(const tree of objects.filter(o=>o.type==='tree'&&layoutTerrain(o.x,o.z)>=3.5&&layoutTerrain(o.x,o.z)<=28)){
    const biome=ISLANDS.reduce((a,b)=>Math.hypot(tree.x-a.x,tree.z-a.z)/a.r<Math.hypot(tree.x-b.x,tree.z-b.z)/b.r?a:b);
    const kind=ISLANDS.indexOf(biome),density=[9,18,5,6][kind],tone=new THREE.Color([0xa2b39a,0x91ae91,0xacae9d,0xc3b58c][kind]);
    for(let patch=0;patch<4;patch++){
      const angle=random()*Math.PI*2,distance=2.3+random()*3.8*tree.scale;
      const cx=tree.x+Math.cos(angle)*distance,cz=tree.z+Math.sin(angle)*distance,radius=1.5+random()*1.5;
      for(let plant=0;plant<density;plant++){
        const a=random()*Math.PI*2,r=Math.sqrt(random())*radius,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,y=layoutTerrain(x,z);
        const gx=Math.floor(x),gz=Math.floor(z);
        const slope=Math.hypot(layoutTerrain(x+.5,z)-layoutTerrain(x-.5,z),layoutTerrain(x,z+.5)-layoutTerrain(x,z-.5));
        if(y<3.5||y>28||slope>.6||Math.hypot(x-SPAWN.x,z-SPAWN.z)<7||LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<(o.id==='cottage'?9:7))||pathDistance(x,z,SPAWN,keeper)<2.5||pathDistance(x,z,keeper,cottage)<2.5)continue;
        if(objects.some(o=>['tree','stone','crystal'].includes(o.type)&&Math.hypot(x-o.x,z-o.z)<(o.type==='tree'?1.1:2.8)*o.scale+.4))continue;
        let crowded=false;
        for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if((occupied.get(`${gx+dx},${gz+dz}`)??[]).some(p=>Math.hypot(x-p[0],z-p[1])<.8))crowded=true;
        if(crowded)continue;
        const cell=`${gx},${gz}`;if(!occupied.has(cell))occupied.set(cell,[]);occupied.get(cell).push([x,z]);
        const scale=.8+random()*.6;
        dummy.position.set(x,terrain(x,z)-.04,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.set(scale,scale*(.75+random()*.25),scale);dummy.updateMatrix();
        const color=tone.clone().multiplyScalar(.88+random()*.12),currentHeight=terrain(x,z);
        if(currentHeight<3.5||currentHeight>28)continue;
        const currentSlope=Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5));
        if(currentSlope>.6)continue;
        const habitat=estuaryHabitat(x,z,currentHeight,currentSlope);
        if(habitat){
          const spread=1+habitat.shelter*.6-habitat.bedrock*.22;
          dummy.scale.multiplyScalar(spread);dummy.updateMatrix();color.multiplyScalar(1-habitat.shelter*.14);
        }
        matrices.push(dummy.matrix.clone());colors.push(color);
      }
    }
  }
  return regionBatches(createFernClump(),matrices,'meadow-fern',32,colors,groundHeight);
}

function createShoalScrub(objects,groundHeight){
  const random=randomGenerator(12679),dummy=new THREE.Object3D(),matrices=[],colors=[];
  const nearby=objects.filter(o=>o.x>96&&o.x<180&&o.z>142&&o.z<222);
  const tint=new THREE.Color(0xc7bd8e);
  for(let gx=102;gx<=173;gx+=2.8)for(let gz=149;gz<=213;gz+=2.8){
    const x=gx+(random()-.5)*2.1,z=gz+(random()-.5)*2.1,y=terrain(x,z);
    const slope=Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5));
    const cover=shoalInterior(x,z,y,slope);
    if(!cover||cover.heath<.49||cover.sand>.18||random()>.58*cover.heath)continue;
    const scale=.65+random()*.63;
    if(nearby.some(o=>Math.hypot(o.x-x,o.z-z)<o.scale+1.2*scale))continue;
    dummy.position.set(x,y,z);dummy.rotation.set(0,random()*Math.PI*2,0);
    dummy.scale.set(scale,scale*(.66+cover.heath*.33),scale);dummy.updateMatrix();
    matrices.push(dummy.matrix.clone());colors.push(tint.clone().multiplyScalar(.82+random()*.18));
  }
  const shrub=createCanopy({anchors:[[-.52,.48,0],[.15,.65,-.38],[.39,.54,.42],[0,.82,.04]],
    seed:9186,leavesPerCluster:20,spread:.49,verticalScale:.35,leafScale:.57});
  return regionBatches(shrub,matrices,'shoal-scrub',32,colors,groundHeight);
}

export function createMeadow(random=randomGenerator(4321),objects=[],groundHeight=null,{settlement=false,highland=false,shoal=false}={}){
  const dummy=new THREE.Object3D(),flowers=[],grass=[];
  for(let i=0;i<3000&&flowers.length<1200;i++){
    const x=random()*440-260,z=random()*450-290,y=layoutTerrain(x,z);if(y<2||y>28)continue;
    dummy.position.set(x,terrain(x,z)-.035,z);dummy.rotation.set(0,random()*6,0);dummy.scale.setScalar(.6+random()*.8);dummy.updateMatrix();flowers.push(dummy.matrix.clone());
  }
  for(let i=0;i<85000&&grass.length<26000;i++){
    const x=random()*590-295,z=random()*650-325,y=layoutTerrain(x,z);
    if(y<2.4||y>33||LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<5)||Math.sin(x*.11)*Math.cos(z*.13)<-.5)continue;
    const height=terrain(x,z),sand=shoal?(shoalInterior(x,z,height)?.sand??0):0;
    dummy.position.set(x,height-.04,z);dummy.rotation.set(0,random()*Math.PI*2,0);const scale=.7+random()*.9;dummy.scale.set(scale,scale*(.4+landscapeMass(x,z)*.85)*(1-.76*sand),scale);dummy.updateMatrix();grass.push(dummy.matrix.clone());
  }
  if(settlement){
    const bankRandom=randomGenerator(80813);
    for(let gx=-59;gx<=-27;gx+=.8)for(let gz=69;gz<=95;gz+=.8){
      const x=gx+(bankRandom()-.5)*.7,z=gz+(bankRandom()-.5)*.7,bank=settlementBankAt(x,z);
      if(bank<.34||bankRandom()>.9*bank||LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<5.5))continue;
      const height=terrain(x,z),scale=.55+bankRandom()*.74;
      dummy.position.set(x,height-.04,z);dummy.rotation.set(0,bankRandom()*Math.PI*2,0);
      dummy.scale.set(scale,scale*(.67+.4*bank),scale);dummy.updateMatrix();grass.push(dummy.matrix.clone());
    }
  }
  const batches=[...regionBatches(createWildflower(),flowers,'meadow-flowers',128,[],groundHeight),...regionBatches(createGrassClump(),grass,'meadow-grass',128,[],groundHeight),...createGroundCover(groundHeight),...createShoreCover(groundHeight,highland,shoal),...createForestCover(objects,groundHeight)];
  if(shoal)batches.push(...createShoalScrub(objects,groundHeight));
  if(settlement)for(const batch of batches){
    const data=batch.instanceMatrix.array;let hidden=0;
    for(let i=0;i<batch.count;i++){const at=i*16;if(settlementWearAt(data[at+12],data[at+14])>.36){data[at+13]=-10000;hidden++;}}
    if(hidden){batch.instanceMatrix.needsUpdate=true;batch.userData.settlementHidden=hidden;}
  }
  return batches;
}
