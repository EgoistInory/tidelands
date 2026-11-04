import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {terrain,ISLANDS,LANDMARKS,SPAWN,createWorld} from '../src/world.js';
import {continuousBedrockHeight} from './continuous-bedrock-candidate.js';
import {createConformingBedrock} from './conforming-bedrock-candidate.js';
import {visibleGroundSampler} from '../src/ground-support.js';
const raw=(x,z)=>continuousBedrockHeight(x,z,terrain(x,z),ISLANDS,[SPAWN,...LANDMARKS]);
const geometry=new THREE.PlaneGeometry(800,800,320,320);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position;
for(let i=0;i<positions.count;i++)positions.setY(i,raw(positions.getX(i),positions.getZ(i)));
const visible=visibleGroundSampler(geometry),height=createConformingBedrock(raw),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()),ray=new THREE.Raycaster();mesh.updateMatrixWorld(true);
test('captured multi-metre support gaps agree with actual rendered triangle raycasts',()=>{
 for(const [x,z]of [[-116.25,-246.25],[-48.596624654181575,-268.47057627510407],[-114.3,-244.7],[-93.2,-237.9],[-70,102]]){
  ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(mesh,false)[0];assert(hit);
  assert(Math.abs(height(x,z)-hit.point.y)<1e-5,`${x},${z}: support ${height(x,z)} vs rendered ${hit.point.y}`);
 }
});
test('every resource anchor uses the visible surface without moving any terrain vertex',()=>{
 for(const p of createWorld().objects)assert(Math.abs(height(p.x,p.z)-visible(p.x,p.z))<1e-5,p.id);
 for(let i=0;i<positions.count;i++)assert.equal(Math.fround(height(positions.getX(i),positions.getZ(i))),positions.getY(i));
});
test('conforming queries remain continuous across grid and diagonal boundaries',()=>{
 for(const [x,z]of [[-115,-245],[-116.25,-246.25],[-112.5,-247.5],[0,0],[400,400]]){
  for(const [dx,dz]of [[1e-7,0],[-1e-7,0],[0,1e-7],[0,-1e-7]])if(Math.abs(x+dx)<=400&&Math.abs(z+dz)<=400)assert(Math.abs(height(x+dx,z+dz)-height(x,z))<1e-4);
 }
});
