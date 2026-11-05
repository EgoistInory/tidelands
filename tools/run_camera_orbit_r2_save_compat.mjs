// Genuine retained saves imported through the unchanged package's own file chooser.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {world,nextInput} from './journey_path.mjs';import {bindCampaignContacts} from './campaign_contact_plan.mjs';
const contacts=bindCampaignContacts(world),{chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const out='dist/camera-orbit-r2-save-compat-2026-11-05',entry='http://127.0.0.1:4190/dist/tidelands-m5-2026-11-05-camera-orbit-r2/tidelands-local/',key='tidelands-save-v1',sha=b=>createHash('sha256').update(b).digest('hex');
assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const report={entry,complete:false,rows:[],sources:{},scope:'Unmodified packaged index; genuine historical ordinary saves imported via native file chooser in isolated profiles. Desktop keys, 390px touch buttons and mouse-pointer joystick. No state injection or clock change. Separate imported journeys, not a continuous mobile campaign, physical device, audition or performance proof.'};
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});let context;
const journal=event=>fs.appendFileSync(path.join(out,'inputs.jsonl'),JSON.stringify({wall:Date.now(),...event})+'\n');
try{
 for(const [width,source,name] of [[1280,'docs/native-campaign-2026-11-03/06-explorer-save.json','highland'],[390,'docs/campaign-mobile-2026-11-03/final-save.json','mobile-ending'],[390,'docs/native-camp-night-2026-11-04/final-save.json','mobile-night-camp']]){
  const original=fs.readFileSync(source),initial=JSON.parse(original);report.sources[source]=sha(original);
  const row={name,width,source,initial,logs:[],images:[]};report.rows.push(row);
  context=await browser.newContext({viewport:{width,height:width===390?844:800},hasTouch:width===390});
  await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>row.logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))row.logs.push(e.text());});
  async function click(selector){journal({case:name,input:'click',selector});if(width===390)await page.locator(selector).tap();else await page.click(selector);}
  async function observe(){await page.keyboard.press('1');return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
  async function shot(suffix){const image=name+'-'+suffix+'.png';await page.screenshot({path:path.join(out,image)});row.images.push({image,sha256:sha(fs.readFileSync(path.join(out,image)))});}
  async function hold(k,ms){journal({case:name,input:'hold',key:k,ms});await page.keyboard.down(k);try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(k);}}
  await page.goto(entry);await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);await click('#start-button');await click('#pause-button');
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'导入存档',exact:true}).click()]);journal({case:name,input:'filechooser',source});await chooser.setFiles(path.resolve(source));await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('存档已导入'));
  row.imported=await observe();for(const field of ['quest','kills','inventory','buildings','depleted','discovered'])assert.deepEqual(row.imported[field],initial[field],field);assert.equal(row.imported.player.hp,initial.player.hp);assert.equal(row.imported.player.x,initial.player.x);assert.equal(row.imported.player.z,initial.player.z);await shot('imported');
  if(name==='highland'){
   let state=row.imported;const start={...state.player},target={type:'point',id:'old-save-ramp',x:-66,z:-184};
   for(let i=0;i<12&&Math.hypot(state.player.x-start.x,state.player.z-start.z)<2;i++){state.requestedYaw=.15;const route=nextInput(state,target);assert(route.key,JSON.stringify(route));await hold(route.key,route.durationMs);state=await observe();}
   row.moved=Math.hypot(state.player.x-start.x,state.player.z-start.z);assert(row.moved>1);row.after=state;
  }else{
   const box=await page.locator('#joystick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
   journal({case:name,input:'pointer-joystick',dx:22,dy:-25,ms:450});await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+22,y-25);await page.waitForTimeout(450);await page.mouse.up();row.afterJoystick=await observe();row.moved=Math.hypot(row.afterJoystick.player.x-row.imported.player.x,row.afterJoystick.player.z-row.imported.player.z);assert(row.moved>.5);
   if(name==='mobile-ending'){await click('[data-slot="food"]');row.after=await observe();assert.equal(row.after.inventory.berry,initial.inventory.berry-1);assert.equal(row.after.player.hp,Math.min(100,row.afterJoystick.player.hp+18));}
   else{assert((await page.locator('#interact-label').textContent()).includes('休息'));await click('#interact-button');await page.waitForTimeout(250);row.after=await observe();row.restToast=await page.locator('#toast').textContent();assert(row.restToast.includes('已恢复'));assert.equal(row.after.player.hp,100);}
  }
  await click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();const saved=await page.evaluate(key=>localStorage.getItem(key),key);row.saved=JSON.parse(saved);for(const field of ['quest','kills','buildings'])assert.deepEqual(row.saved[field],initial[field]);fs.writeFileSync(path.join(out,name+'-save.json'),saved);row.saveSha256=sha(saved);
  row.layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,hidden:document.hidden,glError:document.querySelector('#world').getContext('webgl2').getError()}));assert(row.layout.width===width&&row.layout.scrollWidth===width&&!row.layout.hidden&&row.layout.glError===0);await shot('saved');
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);row.reloadExact=true;assert.equal(row.logs.length,0);assert.equal(sha(fs.readFileSync(source)),report.sources[source]);await context.close();context=null;
  console.log(JSON.stringify({case:name,moved:row.moved,hp:row.saved.player.hp,reloadExact:true}));
 }
 report.complete=true;
}catch(e){report.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');if(context)await context.close();contacts.release();await browser.close();}
