// Unresolved ordinary R2 observation. Explicit RED experiment; no production fix is claimed.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from '../../vendor/three.module.min.js';
import {unobstructedCamera,smoothCamera} from '../../src/camera.js';import {terrain} from '../../src/world.js';
const c=JSON.parse(fs.readFileSync(new URL('../../docs/camera-orbit-2026-11-05/remaining-case.json',import.meta.url))),v=p=>new THREE.Vector3(...p),f=v(c.focus),cur=v(c.current),boxes=c.boxes.map(b=>new THREE.Box3(v(b.min),v(b.max))),yaw=p=>Math.atan2(p.x-f.x,p.z-f.z),safe=unobstructedCamera(f,v(c.desired),boxes,terrain,6,yaw(cur)),next=smoothCamera(f,cur,safe,boxes,terrain,c.dt,Math.min(6,safe.distanceTo(f)));
test('remaining field input reproduces exactly',()=>assert(next.distanceTo(v(c.fieldActual))<1e-6));
test('remaining field input must avoid an over-45-degree instantaneous orbit',()=>{const turn=Math.abs(Math.atan2(Math.sin(yaw(next)-yaw(cur)),Math.cos(yaw(next)-yaw(cur))));assert(turn<=Math.PI/4,`Remaining orbit ${turn*180/Math.PI} degrees`);});
test('remaining camera point must be outside every captured part',()=>assert(!boxes.some(b=>b.containsPoint(next))));
