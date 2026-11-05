import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from '../vendor/three.module.min.js';
import {unobstructedCamera,smoothCamera} from '../src/camera.js';import {terrain} from '../src/world.js';
const c=JSON.parse(fs.readFileSync(new URL('../docs/movement-native-2026-11-05/camera-case.json',import.meta.url))),v=p=>new THREE.Vector3(...p),boxes=c.boxes.map(b=>new THREE.Box3(v(b.min),v(b.max)));
function next(){const focus=v(c.focus),current=v(c.current),safe=unobstructedCamera(focus,v(c.desired),boxes,terrain,6,Math.atan2(current.x-focus.x,current.z-focus.z));return smoothCamera(focus,current,safe,boxes,terrain,c.dt,Math.min(6,safe.distanceTo(focus)));}
test('actual native corner keeps the camera outside all captured parts, with clear ray and terrain clearance',()=>{
 const p=next(),f=v(c.focus),ray=new THREE.Ray(f,p.clone().sub(f).normalize());assert(p.distanceTo(f)>=v(c.current).distanceTo(f),'already retracted camera must retain subject space');
 for(const b of boxes){assert(!b.containsPoint(p),'camera point may not remain inside the focus-enclosing crown');if(b.containsPoint(f))continue;const hit=ray.intersectBox(b,new THREE.Vector3());assert(!hit||hit.distanceTo(f)>p.distanceTo(f));}
 assert(p.y>=terrain(p.x,p.z)+.35);
});
test('actual native corner cannot bypass easing with a far-side instantaneous camera orbit',()=>{
 const p=next(),yaw=p=>Math.atan2(p.x-c.focus[0],p.z-c.focus[2]),step=Math.abs(Math.atan2(Math.sin(yaw(p)-yaw(v(c.current))),Math.cos(yaw(p)-yaw(v(c.current)))));assert(step<=Math.PI/4,`Native corner orbit step ${step*180/Math.PI} degrees`);
});
test('a second ordinary crown case retracts safely instead of mirroring the camera across the player',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../docs/camera-orbit-2026-11-05/blocked-case.json',import.meta.url))),f=v(c.focus),cur=v(c.current),b=c.boxes.map(o=>new THREE.Box3(v(o.min),v(o.max))),yaw=p=>Math.atan2(p.x-f.x,p.z-f.z);
 const safe=unobstructedCamera(f,v(c.desired),b,terrain,6,yaw(cur)),p=smoothCamera(f,cur,safe,b,terrain,c.dt,Math.min(6,safe.distanceTo(f))),ray=new THREE.Ray(f,p.clone().sub(f).normalize());
 assert(b.some(box=>box.containsPoint(f)),'Captured crown surrounds the focus');assert(p.distanceTo(f)>=2);assert(p.y>=terrain(p.x,p.z)+.35);
 for(const box of b){assert(!box.containsPoint(p));if(box.containsPoint(f))continue;const hit=ray.intersectBox(box,new THREE.Vector3());assert(!hit||hit.distanceTo(f)>p.distanceTo(f));}
 const step=Math.abs(Math.atan2(Math.sin(yaw(p)-yaw(cur)),Math.cos(yaw(p)-yaw(cur))));assert(step<=Math.PI/4,`Second native orbit step ${step*180/Math.PI} degrees`);
});
