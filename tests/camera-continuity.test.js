import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createWorld,terrain} from '../src/world.js';
import {unobstructedCamera,smoothCamera} from '../src/camera.js';

test('the exposed forest corner uses a nearby clear angle while preserving subject distance',()=>{
  const view={world:createWorld(),scene:new THREE.Scene(),buildings:new Map(),creatures:new Map()};WorldView.prototype.createScenery.call(view);
  const p={x:136.37605557715017,z:-46.326840521710785},current=new THREE.Vector3(136.58997409291834,29.065225202497764,-32.170426941029234);
  const focus=new THREE.Vector3(p.x,terrain(p.x,p.z)+2.4,p.z),yaw=.15+12*.008;
  const target=new THREE.Vector3(p.x+Math.sin(yaw)*14,focus.y+Math.tan(.29)*14,p.z+Math.cos(yaw)*14);target.y=Math.max(target.y,terrain(target.x,target.z)+1.5);
  const boxes=view.cameraObstacles.filter(({object:o})=>Math.hypot(o.x-p.x,o.z-p.z)<26).flatMap(o=>o.boxes??[o.box]),bearing=v=>Math.atan2(v.x-p.x,v.z-p.z);
  const safe=unobstructedCamera(focus,target,boxes,terrain,6,bearing(current)),next=smoothCamera(focus,current,safe,boxes,terrain,1/60,Math.min(6,safe.distanceTo(focus)));
  const turn=Math.abs(Math.atan2(Math.sin(bearing(next)-bearing(current)),Math.cos(bearing(next)-bearing(current))))*180/Math.PI;
  // This incoming ray needs at least 9 degrees to clear the nearby corner.
  assert.ok(turn<12,`one-frame physical orbit must not snap32degrees; got${turn}`);
  assert.ok(next.distanceTo(focus)>1.2,'temporary retraction must not collapse into the subject');
  const ray=new THREE.Ray(focus,next.clone().sub(focus).normalize());
  for(const box of boxes){if(box.containsPoint(focus))continue;const hit=ray.intersectBox(box,new THREE.Vector3());assert.ok(!hit||hit.distanceTo(focus)>next.distanceTo(focus));}
  assert.ok(next.y>=terrain(next.x,next.z)+.35);
});
