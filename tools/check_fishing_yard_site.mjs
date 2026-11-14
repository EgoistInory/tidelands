// Conservative static occupancy planning only. Does not move or delete any world content.
import fs from 'node:fs';import * as T from '../vendor/three.module.min.js';
import {world} from './journey_path.mjs';import {bindCampaignContacts} from './campaign_contact_plan.mjs';
import {footprintBoxes} from '../src/resource-footprint.js';import {resourceHalfSize} from '../src/resource-contact.js';
import {terrain,LANDMARKS} from '../src/world.js';import {createFishingYardCandidate} from './fishing_yard_candidate.js';
const bound=bindCampaignContacts(world),state=JSON.parse(fs.readFileSync('docs/settlement-ground-2026-11-15/route-final-save.json')),rows=[];
try{
 const blockers=world.objects.map(o=>{const boxes=footprintBoxes(o)?.map(([a,b])=>new T.Box3(new T.Vector3(...a),new T.Vector3(...b)));const r=o.type==='tree'?1.15:resourceHalfSize(o);return {id:o.id,boxes:boxes??[new T.Box3(new T.Vector3(o.x-r,terrain(o.x,o.z),o.z-r),new T.Vector3(o.x+r,terrain(o.x,o.z)+3.5*o.scale,o.z+r))]};});
 for(const o of [...LANDMARKS.filter(o=>o.type==='cottage'||o.type==='npc'),...state.buildings]){const r=o.type==='cottage'?4.6:o.type==='npc'?.75:2.2,y=terrain(o.x,o.z);blockers.push({id:o.id,boxes:[new T.Box3(new T.Vector3(o.x-r,y,o.z-r),new T.Vector3(o.x+r,y+(o.type==='cottage'?9:3),o.z+r))]});}
 for(const [x,z]of [[-33,77],[-30,72],[-26,72],[-26,78],[-22,78],[-28,84],[-32,88],[-35,84]]){
  const kit=createFishingYardCandidate({x,z},terrain),intersections=blockers.filter(o=>o.boxes.some(b=>kit.boxes.some(k=>k.intersectsBox(b)))).map(o=>o.id),heights=kit.posts.map(p=>p.foot);
  rows.push({x,z,intersections,supportHeightRange:Math.max(...heights)-Math.min(...heights),boxCount:kit.boxes.length,batches:kit.root.children.length});kit.release();
 }
 fs.writeFileSync('dist/fishing-yard-sites-2026-11-15.json',JSON.stringify({rows,scope:'Conservative proxy/body-box static occupancy, not full canopy or dynamic legacy-building compatibility. No source/world/state writes.'},null,2)+'\n');console.log(JSON.stringify(rows));
}finally{bound.release();}
