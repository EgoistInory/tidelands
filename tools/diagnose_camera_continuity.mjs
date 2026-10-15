import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createWorld,terrain} from '../src/world.js';
import {unobstructedCamera} from '../src/camera.js';
const evidence=JSON.parse(fs.readFileSync(new URL('../docs/motion-current-forest.json',import.meta.url),'utf8'));
const sample=evidence.row.jumpSamples[0],p={x:sample.player[0],z:sample.player[1]},current=new THREE.Vector3(...sample.previousCamera),focus=new THREE.Vector3(p.x,terrain(p.x,p.z)+2.4,p.z),view={world:createWorld(),scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};WorldView.prototype.createScenery.call(view);
const boxes=view.cameraObstacles.filter(({object:o})=>Math.hypot(o.x-p.x,o.z-p.z)<26).flatMap(o=>o.boxes??[o.box]);
const delta=current.clone().sub(focus),up=new THREE.Vector3(0,1,0),rows=[];
for(let degrees=-30;degrees<=30;degrees++){
 const desired=delta.clone().applyAxisAngle(up,degrees*Math.PI/180).add(focus),safe=unobstructedCamera(focus,desired,boxes,terrain);
 rows.push({degrees,distance:safe.distanceTo(focus),camera:safe.toArray()});
}
const blocking=boxes.flatMap((box,index)=>{const hit=new THREE.Ray(focus,delta.clone().normalize()).intersectBox(box,new THREE.Vector3());return hit?[{index,min:box.min.toArray(),max:box.max.toArray(),hitDistance:hit.distanceTo(focus)}]:[];});
const report={scope:'Exposed current forest frame72; same-player bearing rather than previous-frame bearing, static production boxes and terrain, fixed angular probes; not browser-frame replay or final quality acceptance.',focus:focus.toArray(),current:current.toArray(),blocking,rows};fs.writeFileSync(new URL('../docs/camera-continuity-probes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({blocking,nearClear:rows.filter(r=>r.distance>1.2).slice(-12),best:rows.filter(r=>r.distance>1.2).sort((a,b)=>Math.abs(a.degrees)-Math.abs(b.degrees)).slice(0,5)},null,2));
