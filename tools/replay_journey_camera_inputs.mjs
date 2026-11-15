// Replay captured numerical camera inputs, not a reconstructed world or inferred delta time.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.min.js';import {terrain} from '../src/world.js';import {unobstructedCamera,smoothCamera} from '../src/camera.js';
const folder=process.argv[2],target=path.join(folder,'camera-input-replay.json');assert(folder&&!fs.existsSync(target));
const batches=fs.readFileSync(path.join(folder,'samples.jsonl'),'utf8').trim().split('\n').map(JSON.parse),cases=batches.flatMap(b=>b.cameraCases??[]),sha=b=>createHash('sha256').update(b).digest('hex');
const report={scope:'Pure replay of the actual captured full obstacle boxes, dt and camera inputs. No source change, world reconstruction, game input or pose quality claim.',cameraSourceSha256:sha(fs.readFileSync('src/camera.js')),samplesSha256:sha(fs.readFileSync(path.join(folder,'samples.jsonl'))),cases:[]};
for(const c of cases){
 const i=c.input;assert(i.boxes.length<20000&&i.dt>=0&&i.dt<=.05);assert.equal(i.dt,c.after[16]);
 const focus=new T.Vector3(...i.focus),current=new T.Vector3(...i.current),desired=new T.Vector3(...i.desired),boxes=i.boxes.map(([a,b])=>new T.Box3(new T.Vector3(...a),new T.Vector3(...b)));
 const renderedYaw=Math.atan2(current.x-focus.x,current.z-focus.z),safe=unobstructedCamera(focus,desired,boxes,terrain,6,renderedYaw),actual=smoothCamera(focus,current,safe,boxes,terrain,i.dt,Math.min(6,safe.distanceTo(focus))),field=c.after.slice(13,16),error=actual.distanceTo(new T.Vector3(...field));
 report.cases.push({frame:c.frame,time:c.time,degrees:c.degrees,boxCount:boxes.length,fieldErrorMetres:error,exact:error<1e-6,actual:actual.toArray(),field});
}
report.complete=cases.length>0&&report.cases.every(c=>c.exact);fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.complete)process.exitCode=1;
