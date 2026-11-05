// Browser plugin absent: isolated existing Playwright, full package canvas and native inputs.
// Only the served scene module gains a read-only, bounded streaming observer.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {world,nextInput,plan} from './journey_path.mjs';import {terrain,LANDMARKS} from '../src/world.js';import {nearest} from '../src/game.js';import {bindCampaignContacts} from './campaign_contact_plan.mjs';
const plannerContacts=bindCampaignContacts(world),{chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const mode=process.argv[2]??'desktop';assert(['desktop','narrow'].includes(mode));
const out=`dist/runtime-ceiling-2026-11-05-${mode}`,packageName='tidelands-m5-2026-11-05-camera-orbit-r2',entry=`http://127.0.0.1:4190/dist/${packageName}/tidelands-local/`,key='tidelands-save-v1',sha=b=>createHash('sha256').update(b).digest('hex');assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const originalProfile='dist/runtime-budget-2026-11-05-desktop/browser-state.json',originalSave='docs/runtime-budget-2026-11-05/desktop-final-save.json',initial=fs.readFileSync(originalSave,'utf8'),observer=fs.readFileSync('tools/runtime_budget_probe.js','utf8');
const report={entry,mode,complete:false,phases:[],logs:[],heap:[],initialSaveSha256:sha(initial),initialProfileSha256:sha(fs.readFileSync(originalProfile)),packageSha256:sha(fs.readFileSync(`dist/${packageName}.zip`)),observerSha256:sha(observer),scope:'Native continuation, full actual canvas, desktop1920x1080/DPR1 or narrow390x844/DPR2 capped by game at585x1266, read-only actual-render GPU query and CPU observer. Streamed batches capped at180 frames and4 in-flight batches. No game/camera/clock/enemy injection. Ten-minute ordinary continuation, 60-second natural paused observation and reload; no forced GC. Local cache startup; isolated headless Metal browser, not physical mobile, system GPU isolation, VRAM, thermal, audio listening or final3A acceptance.'},journal=e=>fs.appendFileSync(path.join(out,'inputs.jsonl'),JSON.stringify({wall:Date.now(),...e})+'\n');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']}),context=await browser.newContext({viewport:mode==='desktop'?{width:1920,height:1080}:{width:390,height:844},deviceScaleFactor:mode==='desktop'?1:2,storageState:originalProfile});
let heapTimer,heapPending=false,heapPhase='active';
let page,video,state,started=false,steps=0,respawns=0,lastPosition=null;
async function press(k){journal({input:'press',key:k});await page.keyboard.press(k);}
async function walk(k,ms){journal({input:'hold',key:k,ms});await page.keyboard.down(k);try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(k);}}
async function observe(){await press('1');state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert(state&&Number.isFinite(state.time));state.requestedYaw=.15;
 if(lastPosition&&Math.hypot(state.player.x-lastPosition.x,state.player.z-lastPosition.z)>30){respawns++;journal({event:'observed-position-jump',from:lastPosition,to:state.player});}lastPosition={...state.player};
 return state;
}
async function snapshot(name){await observe();const json=structuredClone(state);delete json.requestedYaw;fs.writeFileSync(path.join(out,name+'-save.json'),JSON.stringify(json,null,2)+'\n');
 const image=name+'.jpg';await page.screenshot({path:path.join(out,image),type:'jpeg',quality:86});const ui=await page.evaluate(()=>({title:document.querySelector('#quest-title').textContent,hp:Number(document.querySelector('#hp').value),toast:document.querySelector('#toast').textContent,hidden:document.hidden,glError:document.querySelector('#world').getContext('webgl2').getError(),viewport:[innerWidth,innerHeight],buffer:[document.querySelector('#world').width,document.querySelector('#world').height],dpr:devicePixelRatio,day:document.querySelector('#daytime').textContent}));assert(!ui.hidden&&ui.glError===0);
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
 await context.exposeBinding('__budgetSink',(source,batch)=>fs.appendFileSync(path.join(out,'samples.jsonl'),JSON.stringify(batch)+'\n'));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:4190')return route.abort();if(u.pathname==='/__runtime-budget-probe.js')return route.fulfill({contentType:'text/javascript',body:observer});if(u.pathname===`/dist/${packageName}/tidelands-local/src/scene.js`){const source=fs.readFileSync(`dist/${packageName}/tidelands-local/src/scene.js`,'utf8');return route.fulfill({contentType:'text/javascript',body:source+`\nimport {installBudgetProbe} from '/__runtime-budget-probe.js';\nconst budgetDraw=WorldView.prototype.draw;WorldView.prototype.draw=function(...args){this.__budget??=installBudgetProbe(this,window.__budgetSink);return this.__budget.draw(()=>budgetDraw.apply(this,args),args[0],args[3]);};`});}return route.continue();});
 page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
 const loadStart=Date.now();await page.goto(entry);await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);report.localReadyMs=Date.now()-loadStart;assert((await page.title()).includes('潮生群岛'));assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),initial);await page.click('#start-button');started=true;await page.waitForFunction(()=>!!window.runtimeBudget);await page.evaluate(()=>window.runtimeBudget.start());report.startedWall=Date.now();
 const cdp=await context.newCDPSession(page);report.browserVersion=browser.version();
 async function heap(){if(heapPending)return;heapPending=true;try{
  const [js,dom]=await Promise.all([cdp.send('Runtime.getHeapUsage'),cdp.send('Memory.getDOMCounters')]);
  const connected=await page.evaluate(()=>({elements:document.getElementsByTagName('*').length,hidden:document.hidden,day:document.querySelector('#daytime').textContent,heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null}));
  report.heap.push({wall:Date.now(),phase:heapPhase,...js,...dom,...connected});fs.writeFileSync(path.join(out,'heap.json'),JSON.stringify(report.heap,null,2)+'\n');
 }catch(e){report.logs.push('heap: '+e.message);}finally{heapPending=false;}}
 await heap();heapTimer=setInterval(heap,15000);
 report.glIdentity=await page.evaluate(()=>{const gl=document.querySelector('#world').getContext('webgl2'),d=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:d?gl.getParameter(d.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),version:gl.getParameter(gl.VERSION)};});
 await snapshot('00-continued-camp');const camp=state.buildings.find(b=>b.type==='campfire');assert(camp);
 await talk('explorer');await snapshot('01-highland-arrival');
 const crystals=state.inventory.crystal;await gather('crystal',crystals+1);await snapshot('02-highland-gather');
 const beforeKills=state.kills,target=state.enemies.filter(e=>e.hp>0).sort((a,b)=>Math.hypot(a.x-state.player.x,a.z-state.player.z)-Math.hypot(b.x-state.player.x,b.z-state.player.z))[0];assert(target);report.targetEnemy=target.id;await go({...target,type:'npc'});await defend();await observe();assert(state.kills>beforeKills);await snapshot('03-native-combat');
 await talk('botanist');await snapshot('04-woodland-visit');
 await go(camp,{interact:true});await press('e');await page.waitForTimeout(550);await snapshot('05-camp-return');
 let lap=0;const minimumMs=600000;
 while(Date.now()-report.startedWall<minimumMs){for(const [dx,dz] of [[-10,4],[8,5],[4,-5],[0,0]]){
  await go({id:`coastal-${lap++}`,type:'npc',x:camp.x+dx,z:camp.z+dz});
  if(!report.nightCaptured&&(await page.locator('#daytime').textContent()).includes('夜晚')){await snapshot('06-natural-night');report.nightCaptured=true;}
  if(Date.now()-report.startedWall>=minimumMs)break;
 }}
 await go(camp,{interact:true});await press('e');await page.waitForTimeout(550);await snapshot('07-final-rest');assert.equal(state.player.hp,100);assert.equal(state.quest,6);assert.deepEqual(state.buildings,JSON.parse(initial).buildings);
 report.stoppedWall=Date.now();report.probe=await page.evaluate(()=>window.runtimeBudget.stop());await heap();clearInterval(heapTimer);await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();const saved=await page.evaluate(key=>localStorage.getItem(key),key);fs.writeFileSync(path.join(out,'final-save.json'),saved);await context.storageState({path:path.join(out,'browser-state.json')});report.final=JSON.parse(saved);heapPhase='paused';report.pausedStartedWall=Date.now();await heap();heapTimer=setInterval(heap,15000);for(let i=0;i<12;i++)await page.waitForTimeout(5000);await heap();clearInterval(heapTimer);report.pausedEndedWall=Date.now();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);report.reloadExact=true;heapPhase='reloaded';await heap();await page.waitForTimeout(1200);await heap();assert.equal(report.logs.length,0);assert.equal(report.probe.dropped,0);assert.equal(report.probe.errors.length,0);report.complete=true;
}catch(e){report.error=e.stack;console.error(e.stack);process.exitCode=1;
}finally{
 clearInterval(heapTimer);
 if(page&&!page.isClosed()&&started){try{if(!report.probe)report.probe=await page.evaluate(()=>window.runtimeBudget.stop());if(await page.locator('#start-screen').evaluate(e=>e.hidden)){if(!await page.locator('#panel').evaluate(e=>e.open))await page.click('#pause-button',{timeout:5000});const saved=await page.evaluate(key=>localStorage.getItem(key),key);if(saved)fs.writeFileSync(path.join(out,'checkpoint-save.json'),saved);await context.storageState({path:path.join(out,'browser-state.json')});}}catch(e){report.checkpointError=e.message;}}
 report.respawns=respawns;await context.close();assert.equal(sha(fs.readFileSync(originalProfile)),report.initialProfileSha256);assert.equal(sha(fs.readFileSync(originalSave)),report.initialSaveSha256);assert.equal(sha(fs.readFileSync(`dist/${packageName}.zip`)),report.packageSha256);fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');plannerContacts.release();await browser.close();
}
