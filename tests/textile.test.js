import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createTextileMaterial} from '../src/textile.js';
import {createCharacter} from '../src/character.js';
import {buildingModel,WorldView} from '../src/scene.js';

const meshes=g=>{const parts=[];g.traverse(o=>{if(o.isMesh)parts.push(o);});return parts;};
test('shared woven textures keep tint and linear relief separate, tile smoothly and use mipmaps',()=>{
  const a=createTextileMaterial(0xb86636),b=createTextileMaterial(0x555747,{side:THREE.DoubleSide});
  assert.equal(a.map,b.map);assert.equal(a.bumpMap,b.bumpMap);assert.notEqual(a.map,a.bumpMap);
  assert.equal(a.color.getHex(),0xb86636);assert.equal(b.color.getHex(),0x555747);assert.equal(b.side,THREE.DoubleSide);
  assert.equal(a.map.colorSpace,THREE.SRGBColorSpace);assert.equal(a.bumpMap.colorSpace,THREE.NoColorSpace);
  for(const t of [a.map,a.bumpMap]){
    assert.equal(t.image.width,128);assert.equal(t.image.height,128);assert.equal(t.wrapS,THREE.RepeatWrapping);assert.equal(t.wrapT,THREE.RepeatWrapping);
    assert.equal(t.minFilter,THREE.LinearMipmapLinearFilter);assert.ok(t.generateMipmaps);
    const values=t.image.data;assert.ok(new Set(values.filter((_,i)=>i%4===0)).size>(t===a.map?8:20));
    for(let i=3;i<values.length;i+=4)assert.equal(values[i],255);
    for(let i=0;i<128;i++)for(let c=0;c<3;c++){
      assert.ok(Math.abs(values[(i*128)*4+c]-values[(i*128+127)*4+c])<8,'horizontal seam');
      assert.ok(Math.abs(values[i*4+c]-values[(127*128+i)*4+c])<8,'vertical seam');
    }
  }
  assert.equal(a.transparent,false);assert.equal(a.metalness,0);assert.ok(a.bumpScale>0&&a.bumpScale<.02);
});
test('only named cloth parts share the textile maps across people and shelter',()=>{
  const player=createCharacter(),npc=createCharacter(0x5f8176),tent=buildingModel('tent');
  const cloth=meshes(player).filter(m=>m.material.userData.textile);
  assert.ok(cloth.length>=15,'coat, panels, scarf, pack, trousers and sleeves');
  const clothMap=cloth[0].material.map;
  for(const group of [player,npc,tent])for(const m of meshes(group).filter(m=>m.material.userData.textile)){
    assert.equal(m.material.map,clothMap);assert.ok(m.geometry.attributes.uv);
    assert.ok([...m.geometry.attributes.uv.array].every(Number.isFinite));
  }
  const skin=meshes(player).filter(m=>m.material.color.getHex()===0xc79878);
  assert.ok(skin.length>=5);skin.forEach(m=>{assert.equal(m.material.map,null);assert.equal(m.material.bumpMap,null);});
  assert.equal(player.userData.sword.getObjectByName('sword-blade').material.map,null);
  assert.equal(player.userData.ankles[0].getObjectByName('boot-sole').material.map,null);
  const maps=new Set(meshes(player).flatMap(m=>[m.material.map,m.material.bumpMap]).filter(Boolean));assert.equal(maps.size,2);
});
test('tent canvas UV measures local panel distances and survives preview disposal',()=>{
  const tent=buildingModel('tent'),cloth=meshes(tent).filter(m=>m.material.userData.textile);
  assert.equal(cloth.length,5);
  for(const mesh of cloth){
    const {position,uv}=mesh.geometry.attributes;
    for(let i=0;i<position.count;i+=3)for(const [a,b] of [[i,i+1],[i+1,i+2],[i+2,i]]){
      const distance=new THREE.Vector3().fromBufferAttribute(position,a).distanceTo(new THREE.Vector3().fromBufferAttribute(position,b));
      const mapped=new THREE.Vector2().fromBufferAttribute(uv,a).distanceTo(new THREE.Vector2().fromBufferAttribute(uv,b));
      assert.ok(Math.abs(distance-mapped)<1e-5,`canvas texel density ${distance}/${mapped}`);
    }
  }
  let released=0;cloth[0].material.map.addEventListener('dispose',()=>released++);
  WorldView.prototype.disposeGroup(tent);assert.equal(released,0);
  const another=buildingModel('tent');assert.equal(meshes(another).find(m=>m.material.userData.textile).material.map,cloth[0].material.map);
});
