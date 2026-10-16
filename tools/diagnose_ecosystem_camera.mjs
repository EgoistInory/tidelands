import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createWorld,terrain} from '../src/world.js';
import {unobstructedCamera} from '../src/camera.js';
const world=createWorld(),view={world,scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};WorldView.prototype.createScenery.call(view);
const p={x:107,z:193},focus=new THREE.Vector3(p.x,terrain(p.x,p.z)+2.4,p.z),boxes=view.cameraObstacles.filter(e=>Math.hypot(e.object.x-p.x,e.object.z-p.z)<29).flatMap(e=>e.boxes??[e.box]);
const rows=[.31,.22,.15,.08,0,-.05,.6,1].map(pitch=>{const desired=new THREE.Vector3(p.x+Math.sin(.15)*17,focus.y+Math.tan(pitch)*17,p.z+Math.cos(.15)*17),safe=unobstructedCamera(focus,desired,boxes,terrain,6,.15);return {pitch,distance:safe.distanceTo(focus),safe:safe.toArray()};});
const report={scope:'Declared shoal107/193; static production boxes and terrain. Probe only; no physical movement/quality acceptance.',focus:focus.toArray(),rows};fs.writeFileSync(new URL('../docs/ecosystem-camera-probes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
