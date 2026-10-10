import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cottageSurfaces,cottageRoof} from '../src/cottage-surfaces.js';

test('roof slope faces have upward finite normals and UVs with physical tile scale',()=>{
  const roof=cottageRoof(),geometry=roof.geometry;
  for(const name of ['position','normal','uv'])assert.ok([...geometry.attributes[name].array].every(Number.isFinite));
  for(let i=0;i<geometry.attributes.normal.count;i++)assert.ok(geometry.attributes.normal.getY(i)>0);
  geometry.computeBoundingBox();assert.ok(geometry.boundingBox.min.x<=-4);assert.ok(geometry.boundingBox.max.z>=3);
  assert.equal(roof.castShadow,true);geometry.dispose();
});

test('architectural materials reuse bounded mipmapped surface textures',()=>{
  const first=cottageSurfaces();assert.equal(cottageSurfaces(),first);
  for(const material of Object.values(first)){
    assert.equal(material.map,material.bumpMap);assert.equal(material.map.image.data.length,256*256*4);
    assert.equal(material.map.generateMipmaps,true);assert.ok(material.roughness>=.85);
    assert.ok(new Set(material.map.image.data).size>20);
  }
});
