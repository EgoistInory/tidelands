import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {createWeatheredRock} from '../src/rock.js';

test('weathered rock geometry is deterministic, finite and stays inside the original sphere',()=>{
  const a=createWeatheredRock(1.8),b=createWeatheredRock(1.8),position=a.geometry.attributes.position,normal=a.geometry.attributes.normal;
  assert.deepEqual(position.array,b.geometry.attributes.position.array);
  assert.deepEqual(a.geometry.attributes.color.array,b.geometry.attributes.color.array);
  assert.equal(position.count/3,320);
  const p=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<position.count;i++){
    p.fromBufferAttribute(position,i);n.fromBufferAttribute(normal,i);
    assert.ok(p.toArray().every(Number.isFinite)&&n.toArray().every(Number.isFinite));
    assert.ok(p.length()<=1.8&&p.length()>1.35);
    assert.ok(Math.abs(n.length()-1)<1e-5&&n.dot(p)>0);
  }
  for(const color of a.geometry.attributes.color.array)assert.ok(Number.isFinite(color)&&color>=0&&color<=1);
  assert.ok(new Set(a.geometry.attributes.color.array).size>100);
  a.geometry.dispose();b.geometry.dispose();
});

test('rock uses smooth shared material and the transformed large stone fits camera clearance',()=>{
  const a=createWeatheredRock(1.8),b=createWeatheredRock(.8);
  assert.equal(a.material,b.material);assert.equal(a.material.flatShading,false);
  assert.equal(a.material.vertexColors,true);assert.ok(a.castShadow&&a.receiveShadow);
  a.scale.set(1.4,.9,1);a.rotation.z=.3;a.position.y=1;a.updateMatrix();
  const bounds=a.geometry.boundingBox.clone().applyMatrix4(a.matrix);
  assert.ok(bounds.min.x>-2.8&&bounds.max.x<2.8&&bounds.min.z>-2.8&&bounds.max.z<2.8);
  assert.ok(bounds.max.y<3.5);
  a.geometry.dispose();b.geometry.dispose();
});
