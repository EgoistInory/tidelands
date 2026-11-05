// Preserved RED quality case from actual ordinary inputs. Explicit experiment, not a passing gate.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from '../../vendor/three.module.min.js';
import {unobstructedCamera,smoothCamera} from '../../src/camera.js';import {terrain} from '../../src/world.js';
const c=JSON.parse(fs.readFileSync(new URL('../../docs/movement-native-2026-11-05/camera-case.json',import.meta.url))),vector=v=>new THREE.Vector3(...v),boxes=c.boxes.map(b=>new THREE.Box3(vector(b.min),vector(b.max)));
function next(){const focus=vector(c.focus),current=vector(c.current),desired=vector(c.desired),safe=unobstructedCamera(focus,desired,boxes,terrain,6,Math.atan2(current.x-focus.x,current.z-focus.z));return smoothCamera(focus,current,safe,boxes,terrain,c.dt,Math.min(6,safe.distanceTo(focus)));}
test('captured authored obstacles exactly reproduce the observed camera position',()=>assert(next().distanceTo(vector(c.fieldActual))<1e-6));
test('ordinary camera avoids a greater than 45 degree orbit jump in one 8.1ms frame',()=>{
 const p=next(),yaw=v=>Math.atan2(v.x-c.focus[0],v.z-c.focus[2]),step=Math.abs(Math.atan2(Math.sin(yaw(p)-yaw(vector(c.current))),Math.cos(yaw(p)-yaw(vector(c.current)))));assert(step<=Math.PI/4,`Actual step ${step*180/Math.PI} degrees`);
});
