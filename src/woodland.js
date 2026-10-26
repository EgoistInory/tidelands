import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {ISLANDS,LANDMARKS,SPAWN,terrain,randomGenerator} from './world.js';
import {landscapeSample,landscapeMass} from './landscape.js';
import {resourceHalfSize} from './resource-contact.js';

function approachDistance(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/length,0,1):0;return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);}
export function woodlandPlacements(objects){
  const random=randomGenerator(2461026),rows=[],routes=LANDMARKS.map(a=>[a,ISLANDS[landscapeSample(a.x,a.z).biome]]);
  for(const anchor of objects){if(anchor.type!=='tree')continue;const {biome}=landscapeSample(anchor.x,anchor.z),height=terrain(anchor.x,anchor.z);
    if(biome===3||height<5||biome===0&&landscapeMass(anchor.x,anchor.z)<.6||biome===2&&height>28)continue;
    const count=biome===1?24:biome===0?12:10;
    for(let n=0;n<count;n++){
      const angle=random()*Math.PI*2,radius=3+random()*8,x=anchor.x+Math.cos(angle)*radius,z=anchor.z+Math.sin(angle)*radius,y=terrain(x,z);
      if(y<=4||Math.hypot(terrain(x+.5,z)-terrain(x-.5,z),terrain(x,z+.5)-terrain(x,z-.5))>.42)continue;
      if(LANDMARKS.some(o=>Math.hypot(x-o.x,z-o.z)<=9)||Math.hypot(x-SPAWN.x,z-SPAWN.z)<=10||routes.some(([a,b])=>approachDistance(x,z,a,b)<=3.5))continue;
      if(objects.some(o=>Math.hypot(x-o.x,z-o.z)<2.1+Math.max(o.type==='tree'?1.15:0,resourceHalfSize(o))))continue;
      const kind=biome!==0&&n%6===0?'moss':'fern';
      rows.push({kind,variant:Math.floor(random()*(kind==='fern'?4:6)),x,z,height:kind==='moss'?.09+random()*.08:.3+random()*.4,rotation:random()*Math.PI*2});
    }
  }return rows;
}
function graphResources(models){const geometries=new Set(),materials=new Set(),textures=new Set();for(const model of models)model.scene.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of [o.material].flat()){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});return {geometries,materials,textures};}
function releaseResources({geometries,materials,textures}){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures){t.dispose();t.source?.data?.close?.();}}
export function createWoodlandDressing(models,objects,placements=woodlandPlacements(objects)){
  const root=new THREE.Group(),resources=graphResources(models),batches=[],dummy=new THREE.Object3D();root.name='regional-woodland';
  const clock={value:0},strength={value:0},player={value:new THREE.Vector2()};let signature=null,released=false;
  function wind(shader){shader.uniforms.woodlandTime=clock;shader.uniforms.woodlandStrength=strength;shader.uniforms.woodlandPlayer=player;
    shader.vertexShader='uniform float woodlandTime,woodlandStrength;varying vec3 woodlandWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 wp=vec4(position,1.0);
      #ifdef USE_INSTANCING
      wp=instanceMatrix*wp;
      #endif
      woodlandWorld=(modelMatrix*wp).xyz;
      float bend=clamp(position.y,0.0,1.0);bend*=bend;
      transformed.x+=sin(woodlandTime*1.3+woodlandWorld.x*.21+woodlandWorld.z*.14)*bend*.035*woodlandStrength;
      transformed.z+=cos(woodlandTime*1.1+woodlandWorld.z*.18)*bend*.025*woodlandStrength;
    `);
    shader.fragmentShader='uniform vec2 woodlandPlayer;varying vec3 woodlandWorld;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      float cover=1.0-smoothstep(48.0,72.0,distance(woodlandWorld.xz,woodlandPlayer));
      float grain=fract(sin(dot(floor(woodlandWorld.xz*80.0),vec2(12.9898,78.233)))*43758.5453);
      if(grain>cover)discard;
    `);
  }
  for(const [mi,model]of models.entries())for(const [variant,node]of model.scene.children.entries()){
    node.position.set(0,0,0);node.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(node),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),kind=mi===0?'fern':'moss';
    node.traverse(part=>{if(!part.isMesh)return;const geometry=part.geometry.clone();geometry.applyMatrix4(part.matrixWorld);geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(1/size.y,1/size.y,1/size.y);geometry.computeBoundingBox();resources.geometries.add(geometry);
      const material=part.material.clone(),depth=new THREE.MeshDepthMaterial({map:material.map,alphaMap:material.alphaMap,alphaTest:material.alphaTest,side:THREE.DoubleSide,depthPacking:THREE.RGBADepthPacking});
      for(const m of [material,depth]){m.onBeforeCompile=wind;m.customProgramCacheKey=()=>kind+'-woodland-v1';resources.materials.add(m);}
      // Moss is too low to bend; the same distance discard still applies to its colour and depth.
      if(kind==='moss')for(const m of [material,depth])m.onBeforeCompile=shader=>{wind(shader);shader.vertexShader=shader.vertexShader.replace('bend*.035*woodlandStrength','bend*0.0').replace('bend*.025*woodlandStrength','bend*0.0');};
      const tiles=new Map();for(const row of placements){if(row.kind!==kind||row.variant!==variant)continue;const key=Math.floor(row.x/32)+','+Math.floor(row.z/32);if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(row);}
      for(const rows of tiles.values()){
        const mesh=new THREE.InstancedMesh(geometry,material,rows.length),matrices=[];mesh.name='woodland-'+kind;mesh.customDepthMaterial=depth;mesh.castShadow=kind==='fern';mesh.receiveShadow=true;
        rows.forEach((p,i)=>{dummy.position.set(p.x,terrain(p.x,p.z)-(kind==='moss'?.025:0),p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.setScalar(p.height);dummy.updateMatrix();const matrix=dummy.matrix.clone();matrices.push(matrix);mesh.setMatrixAt(i,matrix);});
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.computeBoundingSphere();mesh.computeBoundingBox();root.add(mesh);batches.push({mesh,rows,matrices,x:rows.reduce((s,p)=>s+p.x,0)/rows.length,z:rows.reduce((s,p)=>s+p.z,0)/rows.length});
      }
    });
  }
  return {root,placements,update(state,windStrength=.5){if(released)return;clock.value=state.time;strength.value=windStrength;player.value.set(state.player.x,state.player.z);const next=state.buildings.map(b=>[b.id,b.type,b.x,b.z].join(':')).join('|'),changed=signature!==next;signature=next;
    for(const batch of batches){batch.mesh.visible=Math.hypot(batch.x-state.player.x,batch.z-state.player.z)<96;if(!changed)continue;batch.rows.forEach((p,i)=>{const hidden=state.buildings.some(b=>Math.hypot(p.x-b.x,p.z-b.z)<(b.type==='tent'?4.2:3.1));batch.mesh.setMatrixAt(i,hidden?new THREE.Matrix4().makeScale(0,0,0):batch.matrices[i]);});batch.mesh.instanceMatrix.needsUpdate=true;}
  },release(){if(released)return;released=true;root.removeFromParent();root.clear();releaseResources(resources);}};
}
export async function loadWoodlandDressing(objects,{signal}={}){
  const prefix=new URL('../assets/woodland/',import.meta.url),manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const parsed=new URL(url,prefix);if(parsed.origin!==prefix.origin||!parsed.pathname.startsWith(prefix.pathname))throw Error('Woodland assets must remain local');return parsed.href;});
  const loader=new GLTFLoader(manager),results=await Promise.allSettled(['fern_02/fern_02.gltf','rock_moss_set_01/rock_moss_set_01.gltf'].map(n=>loader.loadAsync(new URL(n,prefix).href))),loaded=results.filter(r=>r.status==='fulfilled').map(r=>r.value),failed=results.find(r=>r.status==='rejected');
  if(failed||signal?.aborted){releaseResources(graphResources(loaded));throw failed?.reason??new DOMException('准备已中断','AbortError');}
  try{return createWoodlandDressing(loaded,objects);}catch(error){releaseResources(graphResources(loaded));throw error;}
}
