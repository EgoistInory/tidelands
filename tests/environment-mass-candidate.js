import * as THREE from '../vendor/three.module.min.js';
import {createWeatheredRock} from '../src/rock.js';
import {mergeStaticParts} from '../src/merge-parts.js';
import {ISLANDS,terrain} from '../src/world.js';
import {landscapeMass} from '../src/landscape.js';

// Whole-scene experiment. Existing solid footprints and resource IDs remain authoritative.
export function outcropModel(region){
  const group=new THREE.Group();
  const forms=[
    [[0,.64,0,1.8,1.25,1.3,.12],[.7,1.55,.12,1.32,1.7,.86,-.16],[-1.2,.28,.6,.8,.7,.7,.3]],
    [[-.4,.8,0,1.72,1.6,1.3,-.16],[.85,1.34,.2,1.15,1.85,1,.14],[-1.1,.24,.9,.9,.65,.75,.1]],
    [[-.3,1.15,0,1.5,2.1,1.15,.16],[.9,1.9,-.2,.9,1.65,.82,-.12],[-1.1,.48,.55,.9,1,.9,-.2]],
    [[-.3,.4,0,1.95,.9,1.45,.08],[.7,.8,.2,1.4,1.3,1,.12],[-1.3,.2,.6,.7,.5,.7,.2]]
  ];
  for(const [x,y,z,sx,sy,sz,tilt] of forms[region]){
    const rock=createWeatheredRock(1);rock.position.set(x,y,z);rock.scale.set(sx,sy,sz);rock.rotation.set(0,region*.31,tilt);group.add(rock);
  }
  group.updateMatrixWorld(true);mergeStaticParts(group,{attributes:['normal','position','uv','color']});group.updateMatrixWorld(true);return group;
}

export function installEnvironmentMass(view,world){
  const group=new THREE.Group(),dummy=new THREE.Object3D(),ferns=[],owned=new Set();view.scene.add(group);group.visible=false;
  const originalStones=view.batches.filter(b=>b.entries[0]?.type==='stone').map(b=>b.batch);
  const originalFerns=view.meadow.filter(b=>b.name==='meadow-fern');
  const regionAt=o=>ISLANDS.reduce((best,island,i)=>Math.hypot(o.x-island.x,o.z-island.z)/island.r<Math.hypot(o.x-ISLANDS[best].x,o.z-ISLANDS[best].z)/ISLANDS[best].r?i:best,0);
  const budget={stoneNodes:0,fernInstances:0,tallFernInstances:0,solidLocalBounds:[],batches:0};
  for(let region=0;region<4;region++){
    const entries=world.objects.filter(o=>o.type==='stone'&&regionAt(o)===region),model=outcropModel(region),bounds=new THREE.Box3().setFromObject(model);
    budget.solidLocalBounds.push({region,min:bounds.min.toArray(),max:bounds.max.toArray()});budget.stoneNodes+=entries.length;
    for(const part of model.children){
      owned.add(part.geometry);const batch=new THREE.InstancedMesh(part.geometry,part.material,entries.length);batch.castShadow=batch.receiveShadow=true;batch.name='regional-outcrop-'+region;
      entries.forEach((o,i)=>{dummy.position.set(o.x,terrain(o.x,o.z),o.z);dummy.rotation.set(0,o.rotation,0);dummy.scale.setScalar(o.scale);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix.clone().multiply(part.matrix));});batch.computeBoundingBox();batch.computeBoundingSphere();group.add(batch);
    }
  }
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(const original of originalFerns){
    const batch=new THREE.InstancedMesh(original.geometry,original.material,original.count);batch.name=original.name;batch.receiveShadow=true;
    for(let i=0;i<original.count;i++){
      original.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);const mass=landscapeMass(position.x,position.z),height=.85+mass*1.15;
      // Uneven storeys across the same planted communities, rather than uniform enlargement.
      scale.y*=height;if(height>1.45)budget.tallFernInstances++;matrix.compose(position,rotation,scale);batch.setMatrixAt(i,matrix);
      if(original.instanceColor)batch.setColorAt(i,new THREE.Color().fromBufferAttribute(original.instanceColor,i));
    }
    budget.fernInstances+=original.count;batch.computeBoundingBox();batch.computeBoundingSphere();group.add(batch);ferns.push(batch);
  }
  budget.batches=group.children.length;
  return {group,ferns,budget,setEnabled(enabled){group.visible=enabled;for(const batch of originalStones)batch.visible=!enabled;for(const batch of originalFerns)batch.userData.detailEnabled=!enabled;},dispose(){group.removeFromParent();for(const child of group.children)child.dispose();for(const geometry of owned)geometry.dispose();}};
}
