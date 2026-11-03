// Browser plugin not available. Unmodified packaged index, native inputs, own fresh profile.
// State is observed only through the game's own saves after a native slot-selection key.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {world,nextInput,clearSegment} from './journey_path.mjs';
import {LANDMARKS,terrain} from '../src/world.js';
import {nearest,canBuild} from '../src/game.js';
import {bindCampaignContacts} from './campaign_contact_plan.mjs';
const plannerContacts=bindCampaignContacts(world);
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),out=process.argv[2]??'dist/native-campaign-2026-11-03',resume=process.argv.includes('--resume'),key='tidelands-save-v1';
assert(resume?fs.existsSync(path.join(out,'browser-state.json')):!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const packageName='tidelands-m5-2026-11-03-audio-interruption',entry=`http://127.0.0.1:4190/dist/${packageName}/tidelands-local/`,sha=b=>createHash('sha256').update(b).digest('hex'),manifest=JSON.parse(fs.readFileSync(`dist/${packageName}.json`));
assert.equal(sha(fs.readFileSync(`dist/${packageName}.zip`)),manifest.archiveSha256);
const journal=event=>fs.appendFileSync(path.join(out,'inputs.jsonl'),JSON.stringify({wall:Date.now(),...event})+'\n'),report=resume?JSON.parse(fs.readFileSync(path.join(out,'raw.json'))):{entry,packageSha256:manifest.archiveSha256,phases:[],logs:[],scope:'Unmodified packaged index in a fresh isolated browser context. No init script, route replacement, game-state injection, clock change or teleport. Own ordinary saves are read after actual slot-1 input. Pure Node planning on copied save observations. Not physical device, audition or GPU acceptance.'};
if(resume){const attempt=report.attempt??1;for(const name of ['raw.json','browser-state.json','checkpoint-save.json']){const copy=path.join(out,`attempt-${attempt}-`+name);assert(!fs.existsSync(copy));fs.copyFileSync(path.join(out,name),copy);}report.runs??=[];if(!report.runs.some(r=>r.attempt===attempt))report.runs.push({attempt,video:report.video,videoSha256:report.videoSha256,error:report.error});report.attempt=attempt+1;}else report.attempt=1;
delete report.error;report.complete=false;const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']}),context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:out,size:{width:960,height:600}},...(resume?{storageState:path.join(out,'browser-state.json')}:{})});
let page,video,state,started=false,steps=0,respawns=report.respawns??0,lastPosition=null;
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
  const candidates=world.objects.filter(o=>o.type===type&&!skipped.has(o.id)&&(state.depleted[o.id]??0)<=state.time&&terrain(o.x,o.z)>.7).sort((a,b)=>Math.hypot(a.x-state.player.x,a.z-state.player.z)-Math.hypot(b.x-state.player.x,b.z-state.player.z));const target=candidates[0];assert(target,`No ${type} node available`);
  await go(target,{interact:true});const prior=state.inventory[item];let label=await page.locator('#interact-label').textContent();const expected={tree:'木材',stone:'石料',crystal:'晶石',berry:'浆果'}[type];
  for(let n=0;n<3&&!label.includes(expected);n++){await walk(directionTo(target),100);await observe();label=await page.locator('#interact-label').textContent();}
  await press('e');await page.waitForTimeout(570);await observe();journal({event:'native-gather',planned:target.id,kind:type,before:prior,after:state.inventory[item],label,toast:await page.locator('#toast').textContent()});if(state.inventory[item]===prior)skipped.add(target.id);
 }assert(state.inventory[item]>=minimum,`Collection budget exhausted: ${item}`);
}
async function craftAxe(){await press('c');const row=page.locator('.recipe').filter({has:page.getByRole('heading',{name:'石斧',exact:true})});await row.getByRole('button',{name:'制作',exact:true}).click();journal({input:'click',control:'craft axe'});await page.click('#panel-close');await observe();assert.equal(state.inventory.axe,1);}
async function camp(){
 for(const target of [{id:'camp-search-0',type:'point',x:-70,z:102},{id:'camp-search-1',type:'point',x:-75,z:111},{id:'camp-search-2',type:'point',x:-58,z:110}]){
  await go(target);for(const k of ['w','a','s','d']){await walk(k,120);await observe();const x=state.player.x+Math.sin(state.player.yaw)*6,z=state.player.z+Math.cos(state.player.yaw)*6;if(canBuild(state,world.objects,'campfire',x,z))continue;
   await press('c');const row=page.locator('.recipe').filter({has:page.getByRole('heading',{name:'营火',exact:true})});await row.getByRole('button',{name:'制作',exact:true}).click();journal({input:'click',control:'prepare campfire'});await page.waitForTimeout(180);const tip=await page.locator('#placement-tip').textContent();
   if(tip.includes('在前方放置')){await press('e');await page.waitForTimeout(250);await observe();if(state.buildings.some(b=>b.type==='campfire'))return;}else await press('Escape');journal({event:'placement-observation',tip});
  }
 }throw Error('No accepted native camp placement among bounded search sites');
}
try{
 await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());page=await context.newPage();video=page.video();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
 await page.goto(entry);await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert((await page.title()).includes('潮生群岛'));if(!resume)assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);await page.click('#start-button');started=true;await observe();
 if(!resume){assert(state.quest===0&&state.kills===0&&state.inventory.axe===0&&state.buildings.length===0);await snapshot('00-fresh');}
 if(state.quest===0){await talk('keeper');assert.equal(state.quest,1);await snapshot('01-keeper');}
 if(state.quest===1){await gather('tree',4);await gather('stone',3);await craftAxe();await snapshot('02-axe');}
 if(state.quest===2){await gather('tree',17);await gather('stone',11);await camp();assert.equal(state.quest,3);await snapshot('03-camp');}
 if(state.quest===3){await talk('botanist');assert.equal(state.quest,4);await snapshot('04-botanist');}
 if(state.quest===4){while(state.kills<2){const enemy=state.enemies.filter(e=>e.hp>0&&e.type==='crab').sort((a,b)=>Math.hypot(a.x-state.player.x,a.z-state.player.z)-Math.hypot(b.x-state.player.x,b.z-state.player.z))[0];await go({...enemy,type:'npc'});await defend();await observe();}await snapshot('05-two-kills');await talk('explorer');assert.equal(state.quest,5);await snapshot('06-explorer');}
 if(state.quest===5){await gather('tree',12);await gather('stone',8);await gather('crystal',3);await snapshot('07-lamp-materials');await talk('lighthouse');assert.equal(state.quest,6);await snapshot('08-beacon');}
 await go({id:'post-ending-walk',type:'point',x:-103,z:-42});await snapshot('09-exploration');await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();const saved=await page.evaluate(key=>localStorage.getItem(key),key);fs.writeFileSync(path.join(out,'final-save.json'),saved);await context.storageState({path:path.join(out,'browser-state.json')});await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);report.reloadExact=true;report.complete=true;assert.equal(report.logs.length,0);
}catch(e){report.error=e.stack;console.error(e.stack);process.exitCode=1;
}finally{
 if(page&&!page.isClosed()&&started&&await page.locator('#start-screen').evaluate(e=>e.hidden)){try{if(!await page.locator('#panel').evaluate(e=>e.open))await page.click('#pause-button',{timeout:5000});const saved=await page.evaluate(key=>localStorage.getItem(key),key);if(saved)fs.writeFileSync(path.join(out,'checkpoint-save.json'),saved);await context.storageState({path:path.join(out,'browser-state.json')});}catch(e){report.checkpointError=e.message;}}
 report.respawns=respawns;await context.close();if(video){report.video=path.basename(await video.path());report.videoSha256=sha(fs.readFileSync(path.join(out,report.video)));}fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');plannerContacts.release();await browser.close();
}
