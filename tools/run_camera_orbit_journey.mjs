// Browser plugin not available. Native inputs in the existing package and own ending profile.
// scene.js receives an explicitly declared read-only draw observer; no game-state/clock injection.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {world,nextInput,plan} from './journey_path.mjs';import {terrain,LANDMARKS} from '../src/world.js';import {nearest} from '../src/game.js';import {bindCampaignContacts} from './campaign_contact_plan.mjs';
const plannerContacts=bindCampaignContacts(world),{chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const out='dist/camera-orbit-native-2026-11-05',packageName='tidelands-m5-2026-11-05-camera-orbit',entry=`http://127.0.0.1:4190/dist/${packageName}/tidelands-local/`,key='tidelands-save-v1',sha=b=>createHash('sha256').update(b).digest('hex');assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const originalProfile='dist/movement-native-2026-11-05/browser-state.json',originalSave='docs/movement-native-2026-11-05/final-save.json',initial=fs.readFileSync(originalSave,'utf8'),observer=fs.readFileSync('tools/observe_camera_orbit.js','utf8');
const report={entry,complete:false,phases:[],logs:[],initialSaveSha256:sha(initial),initialProfileSha256:sha(fs.readFileSync(originalProfile)),packageSha256:sha(fs.readFileSync(`dist/${packageName}.zip`)),observerSha256:sha(observer),scope:'Native continuation of the retained ordinary ending profile, with a read-only observer appended to the served scene.js draw. No state/clock/enemy injection or teleport. Source and packaged archive remain unchanged. Observer reads actual soles, contact targets and camera after real draws; diagnostic rates are not a GPU/endurance or natural-motion acceptance.'},journal=e=>fs.appendFileSync(path.join(out,'inputs.jsonl'),JSON.stringify({wall:Date.now(),...e})+'\n');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']}),context=await browser.newContext({viewport:{width:1280,height:800},storageState:originalProfile,recordVideo:{dir:out,size:{width:960,height:600}}});
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
async function defend(){
 let enemy=state.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-state.player.x,e.z-state.player.z)<6).sort((a,b)=>a.hp-b.hp)[0];if(!enemy)return;
 journal({event:'native-encounter',enemy:enemy.id,hp:state.player.hp});
 for(let i=0;i<16&&enemy?.hp>0;i++){
  await heal();await walk(directionTo(enemy),80);await press(state.inventory.axe||state.inventory.sword?'2':'1');await press('Space');await page.waitForTimeout(660);await observe();enemy=state.enemies.find(e=>e.id===enemy.id);if(Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z)>12)break;
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
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:4190')return route.abort();if(u.pathname===`/dist/${packageName}/tidelands-local/src/scene.js`){const source=fs.readFileSync(`dist/${packageName}/tidelands-local/src/scene.js`,'utf8');return route.fulfill({contentType:'text/javascript',body:source+'\n'+observer});}return route.continue();});
 page=await context.newPage();video=page.video();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
 await page.goto(entry);await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert((await page.title()).includes('潮生群岛'));assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),initial);await page.click('#start-button');started=true;
 await page.evaluate(()=>window.movementReview={active:true,rows:[],worst:{},previous:null});await snapshot('00-continued-ending');
 await talk('explorer');assert.equal(state.quest,6);await snapshot('01-highland-arrival');
 const crystals=state.inventory.crystal;await gather('crystal',crystals+1);assert(state.inventory.crystal>=crystals+1);await snapshot('02-highland-gather');
 const camp=state.buildings.find(b=>b.type==='campfire');assert(camp);await go(camp,{interact:true});await press('e');await page.waitForTimeout(550);await snapshot('03-camp-return');assert.equal(state.player.hp,100);assert.equal(state.quest,6);assert.deepEqual(state.buildings,JSON.parse(initial).buildings);
 await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();const saved=await page.evaluate(key=>localStorage.getItem(key),key);fs.writeFileSync(path.join(out,'final-save.json'),saved);await context.storageState({path:path.join(out,'browser-state.json')});report.final=JSON.parse(saved);
 const observation=await page.evaluate(()=>{window.movementReview.active=false;return window.movementReview;});fs.writeFileSync(path.join(out,'observation.json'),JSON.stringify(observation));report.observationSha256=sha(fs.readFileSync(path.join(out,'observation.json')));report.observedFrames=observation.rows.length;report.worst=observation.worst;
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);report.reloadExact=true;assert.equal(report.logs.length,0);report.complete=true;
}catch(e){report.error=e.stack;console.error(e.stack);process.exitCode=1;
}finally{
 if(page&&!page.isClosed()&&started){try{const observation=await page.evaluate(()=>window.movementReview);if(observation&&!fs.existsSync(path.join(out,'observation.json'))){fs.writeFileSync(path.join(out,'observation.json'),JSON.stringify(observation));report.observationSha256=sha(fs.readFileSync(path.join(out,'observation.json')));report.observedFrames=observation.rows.length;report.worst=observation.worst;}if(await page.locator('#start-screen').evaluate(e=>e.hidden)){if(!await page.locator('#panel').evaluate(e=>e.open))await page.click('#pause-button',{timeout:5000});const saved=await page.evaluate(key=>localStorage.getItem(key),key);if(saved)fs.writeFileSync(path.join(out,'checkpoint-save.json'),saved);await context.storageState({path:path.join(out,'browser-state.json')});}}catch(e){report.checkpointError=e.message;}}
 report.respawns=respawns;await context.close();if(video){report.video=path.basename(await video.path());report.videoSha256=sha(fs.readFileSync(path.join(out,report.video)));}assert.equal(sha(fs.readFileSync(originalProfile)),report.initialProfileSha256);assert.equal(sha(fs.readFileSync(originalSave)),report.initialSaveSha256);fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');plannerContacts.release();await browser.close();
}
