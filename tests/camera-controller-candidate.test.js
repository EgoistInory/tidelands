import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../vendor/three.module.min.js';
import {terrain} from '../src/world.js';import {followCameraCandidate} from '../tools/camera_controller_candidate.js';
const cases=JSON.parse(fs.readFileSync(new URL('../docs/settlement-forest-2026-11-15/camera-input-cases.json',import.meta.url))).cases;
for(const c of cases)test(`actual field frame${c.frame}: connected endpoint without an orbit jump`,()=>{
 const i=c.input,f=new T.Vector3(...i.focus),current=new T.Vector3(...i.current),d=new T.Vector3(...i.desired),boxes=i.boxes.map(([a,b])=>new T.Box3(new T.Vector3(...a),new T.Vector3(...b))),before=JSON.stringify(i);
 const result=followCameraCandidate(f,current,d,boxes,terrain,i.dt,{}),p=result.position;
 assert(p.toArray().every(Number.isFinite));assert(!boxes.some(b=>b.containsPoint(p)));assert(p.y>=terrain(p.x,p.z)+.35);
 const a=Math.atan2(c.before[13]-c.before[3],c.before[15]-c.before[4]),b=Math.atan2(p.x-c.after[3],p.z-c.after[4]);assert(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))*180/Math.PI<8);
 assert(p.distanceTo(current)<=14*i.dt+1e-8);assert(p.distanceTo(f)>2);assert.equal(typeof result.occluded,'boolean');assert.equal(JSON.stringify(i),before);
});
test('camera routes around a solid wall and reaches the requested side without crossing it',()=>{
 const f=new T.Vector3(0,2,0),goal=new T.Vector3(0,3,-10),wall=new T.Box3(new T.Vector3(-4,0,-1),new T.Vector3(4,8,1)),route={};let p=new T.Vector3(0,3,10);
 for(let n=0;n<600;n++){const r=followCameraCandidate(f,p,goal,[wall],()=>0,1/60,route);assert(!wall.containsPoint(r.position));assert(r.position.distanceTo(p)<=14/60+1e-8);p=r.position;}
 assert(p.distanceTo(goal)<.2,'detour must progress past both corners');
});
test('explicit inside-camera recovery is finite and leaves saved state and obstacle boxes untouched',()=>{
 const f=new T.Vector3(0,2,-6),p=new T.Vector3(0,2,0),goal=new T.Vector3(0,3,10),wall=new T.Box3(new T.Vector3(-1,0,-1),new T.Vector3(1,4,1)),before=wall.clone(),r=followCameraCandidate(f,p,goal,[wall],()=>0,1/60,{});
 assert(r.recovered);assert(!wall.containsPoint(r.position));assert(wall.equals(before));
});

test('manual orbit requests traverse around the subject at30/60/144fps rather than stopping at its centre',()=>{
 const focus=new T.Vector3(0,2,0),goal=new T.Vector3(0,4,-10);for(const fps of [30,60,144]){let p=new T.Vector3(0,4,10);const route={};for(let i=0;i<fps*6;i++){const r=followCameraCandidate(focus,p,goal,[],()=>0,1/fps,route);assert(p.distanceTo(r.position)<=14/fps+1e-8);assert(r.position.distanceTo(focus)>2);p=r.position;}assert(p.distanceTo(goal)<.2);}
});
test('a terrain ridge is reported as unresolved visibility instead of pretending a material fade solves it',()=>{
 const floor=(x,z)=>z>4&&z<6?5:0,focus=new T.Vector3(0,2,0),p=new T.Vector3(0,5,10),r=followCameraCandidate(focus,p,p,[],floor,1/60,{});assert(r.terrainOccluded);assert(r.unresolved);
});


test('terrain visibility converges by connected elevation without a global orbit switch',()=>{
 const height=(x,z)=>z>4&&z<6?5:0,focus=new T.Vector3(0,2,0),goal=new T.Vector3(0,5,10),route={};let p=goal.clone(),r;
 for(let n=0;n<300;n++){r=followCameraCandidate(focus,p,goal,[],height,1/60,route);assert(!r.recovered);assert(p.distanceTo(r.position)<=14/60+1e-8);assert(Math.abs(r.position.x)<1e-8);p=r.position;}
 assert(!r.terrainOccluded&&!r.unresolved,'elevated lens must clear the ridge rather than remain unresolved forever');assert(p.y>9);
});

test('a detour passes a connected three-wall obstacle without oscillating between covered corners',()=>{
 const box=(a,b)=>new T.Box3(new T.Vector3(...a),new T.Vector3(...b)),boxes=[box([-4,0,-1],[4,9,1]),box([-5,0,-3],[-3,9,3]),box([3,0,-3],[5,9,3])],focus=new T.Vector3(0,2,12),goal=new T.Vector3(0,3,-10),route={};let p=new T.Vector3(0,3,10);
 for(let n=0;n<900;n++){const r=followCameraCandidate(focus,p,goal,boxes,()=>0,1/60,route);assert(!r.recovered);assert(p.distanceTo(r.position)<=14/60+1e-8);assert(!boxes.some(b=>b.containsPoint(r.position)));p=r.position;}
 assert(p.distanceTo(goal)<.25,'must route beyond side walls');
});
