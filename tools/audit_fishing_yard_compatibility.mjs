// Offline copied-save/model audit. No gameplay rules, saves or runtime assets are changed.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.min.js';import {createFishingYard} from '../src/fishing-yard.js';
import {createCampBuilding} from '../src/camp-architecture.js';import {terrain} from '../src/world.js';
import {world} from './journey_path.mjs';import {bindCampaignContacts} from './campaign_contact_plan.mjs';import {canBuild} from '../src/game.js';
const out=process.argv[2]??'dist/fishing-yard-compatibility-2026-11-15.json';assert(!fs.existsSync(out));
const sha=b=>createHash('sha256').update(b).digest('hex'),kit=createFishingYard({x:-33,z:77},terrain),contacts=bindCampaignContacts(world);
const templates=new Map(),saved=[],legalOverlaps=[];
function bounds(type){
 if(!templates.has(type)){
  const model=createCampBuilding(type,null,{surfaces:false});model.updateMatrixWorld(true);templates.set(type,{model,box:new T.Box3().setFromObject(model)});
 }return templates.get(type).box;
}
const bodyBox=p=>new T.Box3(new T.Vector3(p.x-.35,terrain(p.x,p.z),p.z-.35),new T.Vector3(p.x+.35,terrain(p.x,p.z)+2.95,p.z+.35));
const overlap=b=>kit.boxes.some(k=>k.intersectsBox(b));
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.isFile()&&e.name.endsWith('save.json')?[path.join(dir,e.name)]:[]);}
try{
 for(const file of files('docs')){
  const bytes=fs.readFileSync(file),state=JSON.parse(bytes);if(!state.player||!Array.isArray(state.buildings))continue;
  const buildingHits=state.buildings.filter(b=>overlap(bounds(b.type).clone().translate(new T.Vector3(b.x,terrain(b.x,b.z),b.z)))).map(b=>({id:b.id,type:b.type,x:b.x,z:b.z}));
  saved.push({file,sha256:sha(bytes),buildingCount:state.buildings.length,buildingHits,playerInside:overlap(bodyBox(state.player))});
 }
 const base=JSON.parse(fs.readFileSync('docs/settlement-ground-2026-11-15/route-final-save.json'));
 // Explicit synthetic placement fixtures: proximity and funds provided only in this independent copy.
 const state=structuredClone(base);for(const key of Object.keys(state.inventory))state.inventory[key]=999;
 for(let x=-37;x<=-27;x+=.5)for(let z=73;z<=81;z+=.5)for(const type of ['campfire','tent','workbench']){
  state.player.x=x;state.player.z=z;
  if(canBuild(state,world.objects,type,x,z))continue;
  const box=bounds(type).clone().translate(new T.Vector3(x,terrain(x,z),z));if(overlap(box))legalOverlaps.push({type,x,z});
 }
 let triangles=0,vertices=0,bufferBytes=0;
 kit.root.traverse(m=>{if(!m.isMesh)return;vertices+=m.geometry.attributes.position.count;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;for(const a of Object.values(m.geometry.attributes))bufferBytes+=a.array.byteLength;if(m.geometry.index)bufferBytes+=m.geometry.index.array.byteLength;});
 const report={scope:'Offline actual generated camp model AABBs and candidate solid boxes against archived copied saves; explicit synthetic funded/proximity placement grid uses shipped canBuild and contact metadata. No browser/camera/body sweep, full canopy, GPU or universal legacy-save acceptance.',modelSha256:sha(fs.readFileSync('src/fishing-yard.js')),runtimeSha256:Object.fromEntries(['src/game.js','src/fishing-yard-layout.js'].map(file=>[file,sha(fs.readFileSync(file))])),saved,legalOverlaps,geometry:{batches:kit.root.children.length,boxes:kit.boxes.length,vertices,triangles,bufferBytes},summary:{saveCount:saved.length,savesWithBuildingHits:saved.filter(s=>s.buildingHits.length).length,savesWithPlayerInside:saved.filter(s=>s.playerInside).length,currentlyLegalOverlappingPlacements:legalOverlaps.length}};
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));console.log(JSON.stringify(report.geometry));
}finally{
 kit.release();contacts.release();for(const {model}of templates.values()){const geometries=new Set(),materials=new Set(),maps=new Set();model.traverse(m=>{if(m.geometry)geometries.add(m.geometry);for(const mat of m.material?(Array.isArray(m.material)?m.material:[m.material]):[]){materials.add(mat);for(const v of Object.values(mat))if(v?.isTexture)maps.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(m=>m.dispose());model.userData.releaseSurface();}
}
