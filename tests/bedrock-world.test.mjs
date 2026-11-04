import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.min.js';
import {terrain,createWorld} from '../src/world.js';import {TERRAIN_SIZE,TERRAIN_SEGMENTS} from '../src/terrain-grid.js';import {visibleGroundSampler} from '../src/ground-support.js';
test('production resource roots and terrain authority agree with actual Float32 surface triangles',()=>{
 const g=new THREE.PlaneGeometry(TERRAIN_SIZE,TERRAIN_SIZE,TERRAIN_SEGMENTS,TERRAIN_SEGMENTS);g.rotateX(-Math.PI/2);const p=g.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,terrain(p.getX(i),p.getZ(i)));const sample=visibleGroundSampler(g),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial()),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);
 for(const o of createWorld().objects)assert(Math.abs(o.y-sample(o.x,o.z))<1e-5,o.id);
 for(const [x,z]of [[-116.25,-246.25],[-114.3,-224.7],[-48.596624654181575,-268.47057627510407],[13.13,75.77],[166.2,-95.7]]){ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));assert(Math.abs(terrain(x,z)-ray.intersectObject(mesh,false)[0].point.y)<1e-5);}
 for(let x=-165;x<=10;x+=2.5)for(let z=-325;z<=-145;z+=2.5){const h=terrain(x,z);assert(Number.isFinite(h));assert(Math.abs(terrain(x+1e-6,z-1e-6)-h)<1e-4,'No height jump across a cell or diagonal');}
 g.dispose();mesh.material.dispose();
});
