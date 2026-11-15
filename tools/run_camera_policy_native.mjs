// Ordinary file import, bounded forest return and native pointer gestures with QA camera response injection.
import {cameraPolicyScene} from './camera_policy_scene_candidate.mjs';
import {guardCameraQaRoute,assertCameraRestoreEvidence} from './camera_policy_qa.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {world,nextInput,plan} from './journey_path.mjs';import {terrain,LANDMARKS} from '../src/world.js';import {nearest} from '../src/game.js';import {bindCampaignContacts} from './campaign_contact_plan.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),out=process.argv[2]??'dist/camera-policy-native-2026-11-15',width=Number(process.env.JOURNEY_WIDTH??1920),dpr=width===390?1.5:1;
assert([390,1920].includes(width));assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const packageName='tidelands-m5-2026-11-15-yard',entry=`http://127.0.0.1:4190/dist/${packageName}/tidelands-local/`,key='tidelands-save-v1',originalSave=process.env.CAMERA_SAVE??'docs/settlement-forest-2026-11-15/desktop-final-save.json',sha=b=>createHash('sha256').update(b).digest('hex');
const restoreOnly=process.env.CAMERA_RESTORE_ONLY==='1';
const manifest=JSON.parse(fs.readFileSync(`dist/${packageName}.json`));assert.equal(sha(fs.readFileSync(`dist/${packageName}.zip`)),manifest.archiveSha256);
for(const [file,row]of Object.entries(manifest.files)){assert.equal(sha(fs.readFileSync(`dist/${packageName}/tidelands-local/${file}`)),row.sha256);assert.equal(sha(fs.readFileSync(file==='README.md'?'docs/LOCAL-DELIVERY.md':file)),row.sha256);}
const report={entry,width,dpr,restoreOnly,runnerSha256:sha(fs.readFileSync(new URL(import.meta.url))),complete:false,phases:[],logs:[],heap:[],initialSaveSha256:sha(fs.readFileSync(originalSave)),packageSha256:manifest.archiveSha256,probeSha256:sha(fs.readFileSync('tools/journey_frame_probe.js')),timerSha256:sha(fs.readFileSync('tools/runtime_budget_probe.js')),candidateSources:Object.fromEntries(['tools/camera_controller_candidate.js','tools/camera_occlusion_candidate.js','tools/camera_policy_scene_candidate.mjs'].map(p=>[p,sha(fs.readFileSync(p))])),scope:'QA camera injected into extracted unchanged baseline scene; not unmodified-package acceptance. Native file import of our own preferred ordinary progress, continuous input and natural clock. Scene response changes only camera/foreground visibility and appends a bounded read-only observer around full WorldView.draw, including all HDR passes. No teleport, resource/enemy/state/clock injection. Headless Metal 1080p or high-DPI390, not physical phones, VRAM, system GPU isolation, listening or final3A acceptance.'};
for(const p of Object.keys(report.candidateSources))fs.copyFileSync(p,path.join(out,path.basename(p)));
fs.copyFileSync('tools/journey_frame_probe.js',path.join(out,'probe-source.js'));fs.copyFileSync('tools/runtime_budget_probe.js',path.join(out,'timer-source.js'));fs.copyFileSync(new URL(import.meta.url),path.join(out,'runner-source.mjs'));
const journal=e=>fs.appendFileSync(path.join(out,'inputs.jsonl'),JSON.stringify({wall:Date.now(),...e})+'\n'),plannerContacts=bindCampaignContacts(world);
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']}),context=await browser.newContext({viewport:{width,height:width===390?844:1080},deviceScaleFactor:dpr,recordVideo:{dir:out,size:{width:960,height:540}}});
let page,video,state,started=false,steps=0,respawns=0,lastPosition=null;
async function press(k){journal({input:'press',key:k});await page.keyboard.press(k);}
async function walk(k,ms){journal({input:'hold',key:k,ms});await page.keyboard.down(k);try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(k);}}
async function observe(){await press('1');state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert(state&&Number.isFinite(state.time));state.requestedYaw=.15;
 if(lastPosition&&Math.hypot(state.player.x-lastPosition.x,state.player.z-lastPosition.z)>30){respawns++;journal({event:'observed-position-jump',from:lastPosition,to:state.player});}lastPosition={...state.player};
 return state;
}
async function snapshot(name){await observe();const json=structuredClone(state);delete json.requestedYaw;fs.writeFileSync(path.join(out,name+'-save.json'),JSON.stringify(json,null,2)+'\n');
 const image=name+'.png';await page.screenshot({path:path.join(out,image)});const ui=await page.evaluate(()=>({title:document.querySelector('#quest-title').textContent,hp:Number(document.querySelector('#hp').value),toast:document.querySelector('#toast').textContent,hidden:document.hidden,glError:document.querySelector('#world').getContext('webgl2').getError(),viewport:[innerWidth,innerHeight],buffer:[document.querySelector('#world').width,document.querySelector('#world').height]}));assert(!ui.hidden&&ui.glError===0);
 const row={name,save:name+'-save.json',saveSha256:sha(fs.readFileSync(path.join(out,name+'-save.json'))),image,imageSha256:sha(fs.readFileSync(path.join(out,image))),quest:state.quest,kills:state.kills,time:state.time,player:state.player,inventory:state.inventory,buildings:state.buildings,discovered:state.discovered,ui};report.phases.push(row);await context.storageState({path:path.join(out,'browser-state.json')});fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({phase:name,quest:state.quest,kills:state.kills,hp:state.player.hp,time:state.time}));}
function directionTo(target){const dx=target.x-state.player.x,dz=target.z-state.player.z,cs=Math.cos(.15),sn=Math.sin(.15),x=dx*cs-dz*sn,z=dx*sn+dz*cs;return Math.abs(x)>Math.abs(z)?x>0?'d':'a':z>0?'s':'w';}
async function heal(){if(state.player.hp<60&&(state.inventory.berry||state.inventory.meal)){await press('3');await observe();journal({event:'native-food',hp:state.player.hp});}}
const avoidedEncounters=new Set();
async function defend(){
 let enemy=state.enemies.filter(e=>e.hp>0&&!avoidedEncounters.has(e.id)&&Math.hypot(e.x-state.player.x,e.z-state.player.z)<6&&Math.abs(terrain(e.x,e.z)-terrain(state.player.x,state.player.z))<2.5).sort((a,b)=>a.hp-b.hp)[0];if(!enemy)return;
 journal({event:'native-encounter',enemy:enemy.id,hp:state.player.hp});
 let noDamage=0;for(let i=0;i<16&&enemy?.hp>0;i++){const priorHp=enemy.hp,priorSeparation=Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z,terrain(enemy.x,enemy.z)-terrain(state.player.x,state.player.z));
  await heal();await walk(directionTo(enemy),80);await press(state.inventory.axe||state.inventory.sword?'2':'1');await press('Space');await page.waitForTimeout(660);await observe();enemy=state.enemies.find(e=>e.id===enemy.id);if(Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z)>12)break;if(enemy.hp===priorHp&&Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z,terrain(enemy.x,enemy.z)-terrain(state.player.x,state.player.z))>=priorSeparation-.05){if(++noDamage>=3){avoidedEncounters.add(enemy.id);journal({event:'bounded-no-damage-stop',id:enemy.id});break;}}else noDamage=0;
 }journal({event:'encounter-ended',enemy:enemy.id,enemyHp:enemy.hp,kills:state.kills,hp:state.player.hp});
}
async function go(target,{interact=false}={}){
 let stalled=0;
 for(let i=0;i<420;i++){
  await observe();await heal();await defend();
  // Loaded authored footprints can differ from the pure planner's original proxies.
  // The real interaction label is authoritative for collecting that resource kind.
  const label={tree:'木材',stone:'石料',crystal:'晶石',berry:'浆果'}[target.type];
  if(interact&&label&&Math.hypot(state.player.x-target.x,state.player.z-target.z)<8&&(await page.locator('#interact-label').textContent()).includes(label)){journal({event:'native-resource-label-arrival',planned:target.id,label});return;}
  const route=nextInput(state,target);
  if(route.reached){
   if(!interact||nearest(state,world.objects)?.id===target.id)return;
   const before={...state.player};await walk(directionTo(target),100);await observe();if(Math.hypot(state.player.x-before.x,state.player.z-before.z)<.03){stalled++;if(stalled>=3)return;}continue;
  }
  if(!route.key)throw Error(`No route to ${target.id??target.type}: ${route.error}`);
  const before={...state.player};await walk(route.key,route.durationMs);await observe();const moved=Math.hypot(state.player.x-before.x,state.player.z-before.z);stalled=moved<.05?stalled+1:0;
  if(stalled===2){const alternatives=['a','d','s','w'].filter(k=>k!==route.key);await walk(alternatives[0],350);}
  if(stalled>=4)throw Error(`Native movement stalled near ${target.id}`);
  if(++steps%20===0)console.log(JSON.stringify({step:steps,target:target.id,x:state.player.x,z:state.player.z,hp:state.player.hp,quest:state.quest}));
 }throw Error(`Navigation budget exhausted: ${target.id}`);
}
async function talk(id){const target=LANDMARKS.find(o=>o.id===id);await go(target,{interact:true});await press('e');await page.waitForTimeout(550);await observe();journal({event:'native-talk',id,quest:state.quest,toast:await page.locator('#toast').textContent()});}
async function gather(type,minimum){
 const item={tree:'wood',stone:'stone',crystal:'crystal',berry:'berry'}[type],skipped=new Set();let attempts=0;
 while(state.inventory[item]<minimum&&attempts++<35){
  const candidates=world.objects.filter(o=>o.type===type&&!skipped.has(o.id)&&(state.depleted[o.id]??0)<=state.time&&terrain(o.x,o.z)>.7).sort((a,b)=>Math.hypot(a.x-state.player.x,a.z-state.player.z)-Math.hypot(b.x-state.player.x,b.z-state.player.z));
  // A closer node can be above a ledge; choose a bounded alternative before issuing inputs.
  let target;for(const candidate of candidates.slice(0,8)){const route=plan(state,candidate);journal({event:'resource-route-choice',id:candidate.id,visited:route.visited,error:route.error});if(route.reached||route.path.length){target=candidate;break;}skipped.add(candidate.id);}assert(target,`No ${type} candidate within the bounded planner search`);
  await go(target,{interact:true});const prior=state.inventory[item];let label=await page.locator('#interact-label').textContent();const expected={tree:'木材',stone:'石料',crystal:'晶石',berry:'浆果'}[type];
  for(let n=0;n<3&&!label.includes(expected);n++){await walk(directionTo(target),100);await observe();label=await page.locator('#interact-label').textContent();}
  await press('e');await page.waitForTimeout(570);await observe();journal({event:'native-gather',planned:target.id,kind:type,before:prior,after:state.inventory[item],label,toast:await page.locator('#toast').textContent()});if(state.inventory[item]===prior)skipped.add(target.id);
 }assert(state.inventory[item]>=minimum,`Collection budget exhausted: ${item}`);
}

try{
 await context.exposeBinding('__journeySink',(source,batch)=>fs.appendFileSync(path.join(out,'samples.jsonl'),JSON.stringify(batch)+'\n'));
 await context.route('**/*',guardCameraQaRoute(route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:4190')return route.abort();if(u.pathname==='/vendor/three.module.min.js')return route.fulfill({contentType:'text/javascript',body:`export * from '/dist/${packageName}/tidelands-local/vendor/three.module.min.js';`});if(u.pathname===`/dist/${packageName}/tidelands-local/src/scene.js`){let source=fs.readFileSync(`dist/${packageName}/tidelands-local/src/scene.js`,'utf8');source=cameraPolicyScene(source);const marker='const safe=unobstructedCamera(';assert(source.includes(marker));source=source.replace('const began=performance.now();this.cameraRoute??={};','this.__journeyCameraInput={focus,current:this.camera.position.clone(),desired:target,boxes,dt};const began=performance.now();this.cameraRoute??={};');return route.fulfill({contentType:'text/javascript',body:source+`\nwindow.cameraPolicyActive=true;\nimport {installJourneyProbe} from '/tools/journey_frame_probe.js';\nconst journeyDraw=WorldView.prototype.draw;WorldView.prototype.draw=function(...args){this.__journey??=installJourneyProbe(this,window.__journeySink);const result=this.__journey.draw(()=>journeyDraw.apply(this,args),args[0],args[3],args[4]);if(window.cameraNativeOn){const s=args[0],p=this.camera.position.toArray(),r=this.cameraPolicyResult;window.cameraNativeStats??={frames:0,inside:0,recovered:0,terrain:0,unresolved:0,maxShift:0,maxTurn:0,maxTerrainStreak:0,terrainStreak:0,maxControllerCpu:0,exceptions:[]};const q=window.cameraNativeStats,last=this.__cameraNativeLast,angle=Math.atan2(p[0]-s.player.x,p[2]-s.player.z);q.frames++;q.inside+=r.inside?1:0;q.recovered+=r.recovered?1:0;q.terrain+=r.terrainOccluded?1:0;q.unresolved+=r.unresolved?1:0;q.terrainStreak=r.terrainOccluded?q.terrainStreak+1:0;q.maxTerrainStreak=Math.max(q.maxTerrainStreak,q.terrainStreak);q.maxControllerCpu=Math.max(q.maxControllerCpu,this.cameraPolicyCost);if(last){const shift=Math.hypot(...p.map((v,i)=>v-last.p[i])),turn=Math.abs(Math.atan2(Math.sin(angle-last.angle),Math.cos(angle-last.angle)))*180/Math.PI;q.maxShift=Math.max(q.maxShift,shift);q.maxTurn=Math.max(q.maxTurn,turn);if((turn>12||r.inside||r.recovered||r.terrainOccluded)&&q.exceptions.length<24)q.exceptions.push({time:s.time,player:[s.player.x,s.player.z],position:p,turn,shift,inside:r.inside,recovered:r.recovered,terrain:r.terrainOccluded});}this.__cameraNativeLast={p,angle};}return result;};`});}return route.continue();},report.logs));
 page=await context.newPage();video=page.video();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
 const load=Date.now();await page.goto(entry);await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);report.readyWallMs=Date.now()-load;await page.click('#start-button');started=true;await page.click('#pause-button');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles(originalSave);await page.waitForFunction(()=>!document.querySelector('#panel').open);await page.evaluate(()=>(window.cameraNativeOn=true,window.journeyProbe.start()));report.startedWall=Date.now();
 const cdp=await context.newCDPSession(page),heap=async()=>{report.heap.push({wall:Date.now(),...await cdp.send('Runtime.getHeapUsage')});};
 await snapshot('00-settlement');const original=JSON.parse(fs.readFileSync(originalSave)),camp=state.buildings.find(b=>b.type==='campfire');await heap();
 if(restoreOnly){await walk('w',400);await snapshot('01-short-restored-move');}else{
 await go({id:'recorded-forest-approach',type:'npc',x:103.3,z:-20.9});await snapshot('01-forest-approach');await heap();
 // Actual canvas pointer gestures, returned to the initial yaw before key-route planning resumes.
 const canvas=await page.locator('#world').boundingBox(),cx=canvas.x+canvas.width*.5,cy=canvas.y+canvas.height*.45;
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx-120,cy+12,{steps:24});await page.mouse.up();await page.waitForTimeout(1800);await snapshot('02-native-look');
 await page.mouse.move(cx-120,cy+12);await page.mouse.down();await page.mouse.move(cx,cy,{steps:24});await page.mouse.up();await page.waitForTimeout(1000);
 await go(camp,{interact:true});await press('e');await page.waitForTimeout(550);await snapshot('03-original-camp');await heap();assert.equal(state.quest,6);assert.equal(state.player.hp,100);assert.deepEqual(state.buildings,original.buildings);assert.equal(respawns,0);
 }
 report.cameraNative=await page.evaluate(()=>{window.cameraNativeOn=false;return window.cameraNativeStats;});
 assert(report.cameraNative.frames>0);assert.equal(report.cameraNative.inside+report.cameraNative.recovered+report.cameraNative.terrain+report.cameraNative.unresolved,0);assert(report.cameraNative.maxTurn<12);
 report.probe=await page.evaluate(()=>window.journeyProbe.stop());report.stoppedWall=Date.now();assert.equal(report.probe.dropped,0);assert.equal(report.probe.errors.length,0);assert.equal(report.probe.hiddenFrames,0);assert(!report.probe.contextLost);assert.equal(report.probe.issued,report.probe.deleted);
 await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();const saved=await page.evaluate(key=>localStorage.getItem(key),key);fs.writeFileSync(path.join(out,'final-save.json'),saved);report.final=JSON.parse(saved);
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);report.storageBytesPreserved=true;
 const restoreUi={startLabel:await page.locator('#start-button').textContent(),loadStatus:await page.locator('#load-status').textContent()};
 // Activate the real start/pause handlers synchronously, avoiding a simulation frame between them. No closure/state/clock injection.
 await page.evaluate(()=>{document.querySelector('#start-button').click();document.querySelector('#pause-button').click();});assert(await page.locator('#panel').evaluate(e=>e.open));
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档',exact:true}).click();const download=await downloadEvent,exportPath=path.join(out,'restored-live-export.json');await download.saveAs(exportPath);assertCameraRestoreEvidence({...restoreUi,exported:fs.readFileSync(exportPath,'utf8')},saved);report.restore={...restoreUi,exportSha256:sha(fs.readFileSync(exportPath)),fullCanonicalJsonExact:true,scope:'Real start/pause UI handlers activated synchronously before any simulation frame, then ordinary export button/download; no direct state or clock injection.'};assert.deepEqual(report.logs,[]);report.complete=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.stack);
}finally{
 if(page&&!page.isClosed()&&started){try{if(!report.probe)report.probe=await page.evaluate(()=>window.journeyProbe.stop());const saved=await page.evaluate(key=>localStorage.getItem(key),key);if(saved)fs.writeFileSync(path.join(out,'checkpoint-save.json'),saved);}catch(e){report.checkpointError=e.message;}}
 report.respawns=respawns;try{await context.close();if(video){report.video=path.basename(await video.path());report.videoSha256=sha(fs.readFileSync(path.join(out,report.video)));}assert.equal(sha(fs.readFileSync(originalSave)),report.initialSaveSha256);assert.equal(sha(fs.readFileSync(`dist/${packageName}.zip`)),report.packageSha256);}catch(e){report.cleanupError=e.stack;process.exitCode=1;}finally{plannerContacts.release();try{await browser.close();}catch(e){report.browserCloseError=e.stack;process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');}}
}
