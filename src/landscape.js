import * as THREE from '../vendor/three.module.min.js';
import {ISLANDS,LANDMARKS,SPAWN,terrain,randomGenerator} from './world.js';
import {estuaryHabitat} from './estuary-habitat.js';
import {highlandAscent} from './highland-ascent.js';
import {shoalHabitat,shoalInterior} from './shoal-habitat.js';

const estuaryGravel=new THREE.Color(0x77766a),estuarySoil=new THREE.Color(0x485139);
const ascentGravel=new THREE.Color(0xa59a83),ascentLedge=new THREE.Color(0x858b84),ascentHeath=new THREE.Color(0x536348);
const exposedSlate=new THREE.Color(0x777f7b);
const wetShoalSand=new THREE.Color(0x807966),shoalStrand=new THREE.Color(0x837053),duneCover=new THREE.Color(0x85885b);
const compactSand=new THREE.Color(0xb0946b),shoalHeath=new THREE.Color(0x69764a),shoalLedge=new THREE.Color(0x8b8778);
const grass=[0x68794f,0x405e48,0x737b70,0xa79b5f],sand=[0xcabe9b,0xb5b294,0xa2aba4,0xddc38c];
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

// One broad spatial field links canopy storeys and low vegetation, without moving resources.
export function landscapeMass(x,z){
  const wave=Math.sin(x*.045+Math.sin(z*.027)*1.8)*Math.cos(z*.038-x*.017);
  return smooth(.08,.92,(wave+1)*.5);
}

// Only appearance depends on this sample; terrain, node IDs and save data stay authoritative.
export function landscapeSample(x,z){
  const biome=ISLANDS.reduce((best,o,i)=>Math.hypot(x-o.x,z-o.z)/o.r<Math.hypot(x-ISLANDS[best].x,z-ISLANDS[best].z)/ISLANDS[best].r?i:best,0);
  const y=terrain(x,z),slope=Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5));
  const patch=(Math.sin(x*.083+Math.sin(z*.045)*2)+Math.cos(z*.11-x*.031))*.25+.5;
  const dry=smooth(.4,3.8,y),rock=dry*Math.max(smooth(.38,.85,slope),biome===2?smooth(18,34,y)*(.7+patch*.3):smooth(30,43,y)*.65);
  const litter=biome===1?dry*(1-smooth(27,36,y))*smooth(.3,.8,patch)*.65:0;
  const cliff=biome===2?smooth(5,16,y)*smooth(.38,.78,slope):0;
  const color=new THREE.Color(grass[biome]).lerp(new THREE.Color(sand[biome]),1-smooth(1.6,5.8,y));
  color.lerp(new THREE.Color(0x81745b),litter*.7).lerp(new THREE.Color(0x8d9590),rock*.65);
  color.multiplyScalar(.89+patch*.18);
  const shoal=biome===3?shoalHabitat(x,z,y,slope):null;
  const interior=biome===3?shoalInterior(x,z,y,slope):null;
  if(shoal||interior){
    if(shoal)color.lerp(wetShoalSand,shoal.wash*.9).lerp(shoalStrand,shoal.strand*.88).lerp(duneCover,shoal.dune*.72);
    if(interior)color.lerp(compactSand,interior.sand*.75).lerp(shoalHeath,interior.heath*.92).lerp(shoalLedge,interior.ledge*.9);
    return {biome,color,rock:Math.max(rock*(1-(shoal?.wash??0)*.65),(interior?.ledge??0)*.78),
      litter:Math.max((shoal?.strand??0)*.38,(interior?.heath??0)*.47),exposure:0};
  }
  const ascent=highlandAscent(x,z,y,slope);
  if(ascent){
    const exposure=Math.max(cliff,ascent.outcrop)*(1-ascent.wear);
    color.lerp(ascentHeath,ascent.plants*.86).lerp(ascentLedge,ascent.stone*.76)
      .lerp(exposedSlate,ascent.outcrop*(1-ascent.plants*.58)).lerp(ascentGravel,ascent.wear*(.62+.14*patch));
    const rockFace=Math.max(rock*(1-ascent.plants*.74),ascent.stone*.90,exposure*(1-ascent.plants*.60));
    return {biome,color,rock:rockFace*(1-ascent.wear*.46),litter,exposure};
  }
  const habitat=estuaryHabitat(x,z,y,slope);
  if(!habitat)return {biome,color,rock:Math.max(rock,cliff),litter,exposure:cliff};
  color.lerp(estuaryGravel,habitat.gravel*.88).lerp(estuarySoil,habitat.shelter*.8);
  return {biome,color,rock:Math.max(rock,habitat.bedrock*.87),litter:Math.max(litter,habitat.shelter*.48),exposure:0};
}

function createSlateFragments(){
  const edge=[[-1,-.26],[-.63,-.78],[.54,-.70],[1,.13],[.41,.73],[-.54,.57]];
  const base=edge.map(([x,z])=>[x,-.85,z]);
  const top=edge.map(([x,z],i)=>[x*.87,[.55,.65,.9,.74,.47,.61][i],z*.84]);
  const ridge=[.12,1,-.12],positions=[],uvs=[],colors=[];
  const face=(a,b,c,shade)=>{
    for(const [x,y,z] of [a,b,c]){
      positions.push(x,y,z);uvs.push((x+1)*.5,(z+1)*.5);colors.push(shade,shade,shade);
    }
  };
  for(let i=0;i<edge.length;i++){
    const j=(i+1)%edge.length;
    face(ridge,top[j],top[i],i<3?.94:1);
    face(top[i],top[j],base[i],.84);
    face(top[j],base[j],base[i],.84);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();
  return geometry;
}

export function createShoreStones({highland=false,rockSurface}={}){
  const random=randomGenerator(61549),regions=new Map(),dummy=new THREE.Object3D();
  const geometry=new THREE.IcosahedronGeometry(1,1);geometry.computeBoundingBox();
  const material=new THREE.MeshStandardMaterial({vertexColors:false,roughness:.95});
  const add=(x,z,color,name='shore-stones')=>{
    const key=`${name}:${Math.floor(x/64)},${Math.floor(z/64)}`;
    if(!regions.has(key))regions.set(key,{name,entries:[]});
    regions.get(key).entries.push({matrix:dummy.matrix.clone(),color});
  };
  for(const island of ISLANDS)for(let sector=0;sector<180;sector++){
    const angle=sector*Math.PI*2/180+(random()-.5)*.02,dx=Math.cos(angle),dz=Math.sin(angle);
    let lo=0,hi=island.r*1.4;
    if(terrain(island.x+dx*hi,island.z+dz*hi)>.6)continue;
    for(let step=0;step<18;step++){const r=(lo+hi)/2;if(terrain(island.x+dx*r,island.z+dz*r)>.7)lo=r;else hi=r;}
    for(let stone=0;stone<8;stone++){
      const r=lo+.3-random()*7,a=angle+(random()-.5)*.035,x=island.x+Math.cos(a)*r,z=island.z+Math.sin(a)*r,y=terrain(x,z);
      if(y<.45||y>4.5||Math.hypot(x-SPAWN.x,z-SPAWN.z)<8||LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<11))continue;
      const sample=landscapeSample(x,z),radius=.09+random()*.36;
      dummy.position.set(x,y,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.set(radius,.035+random()*.13,radius*(.55+random()*.7));dummy.updateMatrix();
      const color=new THREE.Color([0x898b7b,0x74877e,0x7c8584,0xb0a184][sample.biome]).multiplyScalar(.75+random()*.35);
      add(x,z,color);
    }
  }
  // Low exposed plates follow the existing hill contour and share its rock texture.
  const scree=randomGenerator(3621);
  const slate=highland?createSlateFragments():null;
  const slateMaterial=rockSurface??material;
  const tangent=new THREE.Vector3(),normal=new THREE.Vector3(),depth=new THREE.Vector3(),basis=new THREE.Matrix4();
  if(highland)for(let gx=-103;gx<=-49;gx+=1.75)for(let gz=-201;gz<=-146;gz+=1.75){
    const x=gx+(scree()-.5)*1.65,z=gz+(scree()-.5)*1.65,y=terrain(x,z);
    const dx=terrain(x+.5,z)-terrain(x-.5,z),dz=terrain(x,z+.5)-terrain(x,z-.5),slope=Math.hypot(dx,dz);
    const ascent=highlandAscent(x,z,y,slope);
    if(!ascent||ascent.wear>.11||ascent.stone<.31||scree()>.93*ascent.stone)continue;
    const size=.42+scree()*.95;
    normal.set(-dx,1,-dz).normalize();
    if(slope>.001)tangent.set(dz,0,-dx).normalize();else tangent.set(1,0,0);
    depth.crossVectors(tangent,normal);
    dummy.quaternion.setFromRotationMatrix(basis.makeBasis(tangent,normal,depth));
    dummy.rotateY((scree()-.5)*.47);
    dummy.position.set(x,y-.16,z);
    dummy.scale.set(size,.18+scree()*.19,size*(.37+scree()*.22));dummy.updateMatrix();
    add(x,z,ascentLedge.clone().multiplyScalar(.61+scree()*.43),'highland-scree');
  }
  return [...regions.values()].map(({name,entries})=>{
    const isSlate=name==='highland-scree';
    const batch=new THREE.InstancedMesh(isSlate?slate:geometry,isSlate?slateMaterial:material,entries.length);batch.name=name;batch.receiveShadow=true;
    entries.forEach((e,i)=>{batch.setMatrixAt(i,e.matrix);batch.setColorAt(i,e.color);});batch.computeBoundingBox();batch.computeBoundingSphere();return batch;
  });
}


export function islandTreeAppearance(node){
  const biome=ISLANDS.reduce((best,o,i)=>Math.hypot(node.x-o.x,node.z-o.z)/o.r<Math.hypot(node.x-ISLANDS[best].x,node.z-ISLANDS[best].z)/ISLANDS[best].r?i:best,0);
  const variation=1+Math.sin(node.x*1.37+node.z*.91)*.05;
  const height=[.96,1.22,.78,.87][biome]*variation*(.78+landscapeMass(node.x,node.z)*.38);
  const tint=new THREE.Color().setRGB(...[[.98,.95,.86],[.84,.98,.89],[.90,.95,.95],[1,.90,.72]][biome]);
  return {height,tint,form:['coast','forest','highland','shoal'][biome]};
}
