import * as THREE from '../vendor/three.module.min.js';
import {terrain} from './world.js';
import {isDepleted} from './game.js';

const STEP=2.5,MAX_PATCHES=32,MAX_VERTICES=MAX_PATCHES*96;
const resourceSizes={tree:[.65,.65],stone:[2.2,1.8],crystal:[1.1,1.1]},campSizes={campfire:[1.3,1.3],tent:[2.15,1.85],workbench:[1.65,1.2]};

function texture(){
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const r=Math.hypot((x/(size-1)-.5)*2,(y/(size-1)-.5)*2),i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(255*Math.exp(-r*r*3.5)*Math.max(0,1-r)**.65);
  }
  const map=new THREE.DataTexture(data,size,size);map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}

// Reuse the actual320x320 terrain triangles, rather than placing a flat card through a slope.
function stamp(p,heightAt,emit){
  const c=Math.cos(p.angle??0),s=Math.sin(p.angle??0),ex=Math.abs(c)*p.rx+Math.abs(s)*p.rz,ez=Math.abs(s)*p.rx+Math.abs(c)*p.rz;
  const minX=Math.max(0,Math.floor((p.x-ex+400)/STEP)),maxX=Math.min(320,Math.ceil((p.x+ex+400)/STEP));
  const minZ=Math.max(0,Math.floor((p.z-ez+400)/STEP)),maxZ=Math.min(320,Math.ceil((p.z+ez+400)/STEP));
  for(let iz=minZ;iz<maxZ;iz++)for(let ix=minX;ix<maxX;ix++)for(const [dx,dz]of [[0,0],[0,1],[1,0],[0,1],[1,1],[1,0]]){
    const x=-400+(ix+dx)*STEP,z=-400+(iz+dz)*STEP,h=heightAt(x,z),a=x-p.x,b=z-p.z;
    emit(x,h+.018,z,.5+(a*c-b*s)/(2*p.rx),.5+(a*s+b*c)/(2*p.rz),h>.1?(p.strength??1):0);
  }
}
function geometry(patches,heightAt){
  const positions=[],uv=[],colors=[],ranges=new Map();
  for(const p of patches){const start=positions.length/3;stamp(p,heightAt,(x,y,z,u,v,a)=>{positions.push(x,y,z);uv.push(u,v);colors.push(1,1,1,a);});ranges.set(p.id,{start,count:positions.length/3-start});}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));if(positions.length)g.computeBoundingSphere();return {geometry:g,ranges};
}

export function createContactShade(world,heightAt=terrain){
  const group=new THREE.Group();group.name='contact-shade';
  const material=new THREE.MeshBasicMaterial({color:0x17201b,map:texture(),vertexColors:true,transparent:true,opacity:.3,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const resources=world.objects.filter(o=>resourceSizes[o.type]).map(o=>{const [rx,rz]=resourceSizes[o.type],scale=o.scale??1;return {...o,rx:rx*scale,rz:rz*scale,angle:o.rotation??0};});
  const built=geometry(resources,heightAt),resourceMesh=new THREE.Mesh(built.geometry,material),buildingMesh=new THREE.Mesh(geometry([],heightAt).geometry,material);
  resourceMesh.name='contact-shade-resources';buildingMesh.name='contact-shade-camp';
  const dynamic=new THREE.BufferGeometry();
  for(const [name,size]of [['position',3],['uv',2],['color',4]])dynamic.setAttribute(name,new THREE.BufferAttribute(new Float32Array(MAX_VERTICES*size),size).setUsage(THREE.DynamicDrawUsage));
  dynamic.setDrawRange(0,0);const actorMesh=new THREE.Mesh(dynamic,material);actorMesh.name='contact-shade-actors';actorMesh.frustumCulled=false;
  group.add(resourceMesh,buildingMesh,actorMesh);const baseColor=built.geometry.attributes.color.array.slice(),hidden=new Set();let campKey='',disposed=false;
  function sync(state){
    let changed=false;const color=built.geometry.attributes.color;
    for(const o of resources){const depleted=isDepleted(state,o);if(depleted===hidden.has(o.id))continue;depleted?hidden.add(o.id):hidden.delete(o.id);const {start,count}=built.ranges.get(o.id);for(let i=start;i<start+count;i++)color.array[i*4+3]=depleted?0:baseColor[i*4+3];changed=true;}
    if(changed)color.needsUpdate=true;
    const definitions=state.buildings.filter(b=>campSizes[b.type]),key=JSON.stringify(definitions.map(b=>[b.id,b.type,b.x,b.z]));
    if(key!==campKey){const patches=definitions.map(b=>{const [rx,rz]=campSizes[b.type];return {...b,rx,rz};});buildingMesh.geometry.dispose();buildingMesh.geometry=geometry(patches,heightAt).geometry;campKey=key;}
  }
  function updateActors(player,islanders,creatures){
    const patches=[],center=player.position,near=model=>(model.position.x-center.x)**2+(model.position.z-center.z)**2<2500;
    for(const model of [player,...islanders.map(o=>o.model)])if(near(model))for(const foot of model.userData.worldFeet??[]){
      const ground=heightAt(foot.x,foot.z),strength=THREE.MathUtils.clamp(1-Math.max(0,foot.y-ground)/.6,0,1);
      if(ground>.1&&strength>0)patches.push({x:foot.x,z:foot.z,rx:.38,rz:.48,angle:model.rotation?.y??0,strength});
    }
    for(const model of creatures.values())if(model.visible&&model.userData.hp>0&&near(model)&&heightAt(model.position.x,model.position.z)>.1)patches.push({x:model.position.x,z:model.position.z,rx:model.userData.type==='crab'?1.4:.85,rz:model.userData.type==='crab'?.9:1.2,angle:model.rotation.y,strength:.8});
    patches.sort((a,b)=>(a.x-center.x)**2+(a.z-center.z)**2-(b.x-center.x)**2-(b.z-center.z)**2);
    let count=0,used=0;const pos=dynamic.attributes.position,uv=dynamic.attributes.uv,color=dynamic.attributes.color;
    for(const p of patches.slice(0,MAX_PATCHES)){
      stamp(p,heightAt,(x,y,z,u,v,a)=>{if(used>=MAX_VERTICES)throw Error('Contact shade vertex budget exceeded');pos.setXYZ(used,x,y,z);uv.setXY(used,u,v);color.setXYZW(used,1,1,1,a);used++;});count++;
    }
    dynamic.setDrawRange(0,used);actorMesh.userData.patches=count;for(const a of [pos,uv,color])a.needsUpdate=true;
  }
  function dispose(){if(disposed)return;disposed=true;for(const m of group.children)m.geometry.dispose();material.map.dispose();material.dispose();group.clear();}
  return {group,resourceMesh,buildingMesh,actorMesh,sync,updateActors,dispose};
}
