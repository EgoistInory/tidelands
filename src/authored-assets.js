import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {WARDROBE_ROLES} from './authored-wardrobe.js';
import {createAuthoredCharacter} from './authored-character.js';

export function cloneAuthoredRig(source){
  const copy=source.clone(true),lookup=new Map(),sourceNodes=[],copyNodes=[],skeletons=new Map();source.traverse(o=>sourceNodes.push(o));copy.traverse(o=>copyNodes.push(o));sourceNodes.forEach((o,i)=>lookup.set(o,copyNodes[i]));
  sourceNodes.forEach(o=>{if(!o.isSkinnedMesh)return;let skeleton=skeletons.get(o.skeleton);if(!skeleton){skeleton=new THREE.Skeleton(o.skeleton.bones.map(b=>lookup.get(b)),o.skeleton.boneInverses.map(m=>m.clone()));skeletons.set(o.skeleton,skeleton);}lookup.get(o).bind(skeleton,o.bindMatrix);});return copy;
}
function releaseGraphs(roots){
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  for(const root of roots)root.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);if(!o.isMesh)return;geometries.add(o.geometry);let shared=false;for(let p=o;p;p=p.parent)if(p.name==='author-hand-tools')shared=true;
    if(!shared)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
  });
  for(const m of materials){if(!m.userData.textile)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}
  for(const g of geometries)g.dispose();for(const s of skeletons)s.dispose();for(const t of textures){t.dispose();t.source?.data?.close?.();}
}
export async function loadAuthoredCast({signal}={}){
  const prefix=new URL('../assets/characters/',import.meta.url),manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const parsed=new URL(url,prefix);if(parsed.origin!==prefix.origin||!parsed.pathname.startsWith(prefix.pathname))throw Error('Character assets must remain local');return url;});
  const loader=new GLTFLoader(manager),names=['Superhero_Male_FullBody.gltf','Superhero_Female_FullBody.gltf','UAL1_Standard.glb',...Object.values(WARDROBE_ROLES).map(r=>r.hair+'.gltf')];
  const results=await Promise.allSettled(names.map(name=>loader.loadAsync(new URL(name,prefix).href))),loaded=results.filter(r=>r.status==='fulfilled').map(r=>r.value.scene);
  const failed=results.find(r=>r.status==='rejected');if(failed){releaseGraphs(loaded);throw failed.reason;}
  const scenes=results.map(r=>r.value),roots=[],actors={};let released=false;
  const release=()=>{if(released)return;released=true;releaseGraphs([...roots,...loaded]);};
  try{
    if(signal?.aborted)throw new DOMException('准备已中断','AbortError');
    const response=await fetch(new URL('action-landmarks.json',prefix),{signal});if(!response.ok)throw Error('人物动作资料加载失败');const landmarks=await response.json();
    const library={scene:scenes[2].scene,animations:scenes[2].animations,height:new THREE.Box3().setFromObject(scenes[2].scene,true).getSize(new THREE.Vector3()).y,markers:landmarks.rows};
    for(const [i,[role,style]]of Object.entries(WARDROBE_ROLES).entries()){
      const actor=createAuthoredCharacter(cloneAuthoredRig(scenes[style.sex==='female'?1:0].scene),library,role,scenes[3+i].scene);roots.push(actor);actors[role]=actor;
    }
    return {actors,release,textureMaxEdge:512,animationClips:library.animations.length};
  }catch(error){release();throw error;}
}
