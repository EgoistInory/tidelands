// Reconstruct the prior fixed-input frame from the QA's exposed frame-50 sample.
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {createWorld,terrain} from '../src/world.js';
const root=new URL('../',import.meta.url),ui=JSON.parse(fs.readFileSync(new URL('docs/camera-intent-final-ui.json',root),'utf8'));
const sample=ui.jumpDiagnostic.row.jumpSamples.find(s=>s.frame===50),yaw=.15,dt=1/60;
if(!sample||ui.jumpDiagnostic.route!=='forest')throw new Error('Expected exposed fixed-input forest frame50');
const current={x:sample.player[0],z:sample.player[1]},previous={x:current.x-Math.cos(yaw)*7*dt,z:current.z+Math.sin(yaw)*7*dt};
const focus=p=>new THREE.Vector3(p.x,Math.max(terrain(p.x,p.z),-.45)+2.4,p.z);
const object=createWorld().objects.find(o=>o.id==='resource-944'),r=1.5*object.scale;
const box=new THREE.Box3(new THREE.Vector3(object.x-r,object.y-.3,object.z-r),new THREE.Vector3(object.x+r,object.y+3.5*object.scale,object.z+r));
const report={kind:'fixed-input-camera-origin-boundary-diagnostic',object,box:{min:box.min.toArray(),max:box.max.toArray()},previousPlayerInferredFromDeclaredFixedInput:previous,currentPlayerFromExposedSample:current,previousFocus:focus(previous).toArray(),currentFocus:focus(current).toArray(),previousFocusInside:box.containsPoint(focus(previous)),currentFocusInside:box.containsPoint(focus(current)),jump:sample,limits:['Previous player point inferred from explicit pre-turn fixed direction .15 and production7m/s for1/60s; not hidden browser state.','Exact crystal box formula from scene.createScenery. This proves the containsPoint skip boundary only, not a final collision/motion repair.']};
if(!report.previousFocusInside||report.currentFocusInside)throw new Error('Boundary hypothesis not reproduced');
fs.writeFileSync(new URL('docs/camera-intent-boundary.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({previousInside:report.previousFocusInside,currentInside:report.currentFocusInside,jumpDegrees:sample.stepDegrees}));
