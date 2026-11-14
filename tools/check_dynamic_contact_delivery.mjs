// Isolated ordinary save import and native controls against the unchanged extracted package.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const name=process.argv[2]??'tidelands-m5-2026-11-14-dynamic-contact',out=process.argv[3]??'dist/dynamic-contact-delivery-2026-11-14',mode=process.argv[4]??'combat',key='tidelands-save-v1';
assert(['combat','camp'].includes(mode));
const history=mode==='camp'?'docs/main-mix-2026-11-05/camp-final-save.json':'dist/combat-height-recovery-2026-11-12-combat/checkpoint-save.json',sha=b=>createHash('sha256').update(b).digest('hex');
assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const report={package:name,mode,historySha256:sha(fs.readFileSync(history)),complete:false,logs:[],phases:[]};
const manifest=JSON.parse(fs.readFileSync(`dist/${name}.json`));report.archiveSha256=sha(fs.readFileSync(`dist/${name}.zip`));assert.equal(report.archiveSha256,manifest.archiveSha256);
for(const [file,row] of Object.entries(manifest.files)){assert.equal(sha(fs.readFileSync(`dist/${name}/tidelands-local/${file}`)),row.sha256);assert.equal(sha(fs.readFileSync(file==='README.md'?'docs/LOCAL-DELIVERY.md':file)),row.sha256);}
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
const context=await browser.newContext({viewport:{width:mode==='camp'?390:1280,height:mode==='camp'?844:800},recordVideo:{dir:out,size:{width:960,height:600}}});
await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4190'?route.continue():route.abort());
const page=await context.newPage(),video=page.video();page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['error','warning'].includes(e.type()))report.logs.push(e.text());});
const press=async key=>{fs.appendFileSync(`${out}/inputs.jsonl`,JSON.stringify({key,wall:Date.now()})+'\n');await page.keyboard.press(key);};
async function walk(key,ms){fs.appendFileSync(`${out}/inputs.jsonl`,JSON.stringify({key,ms,wall:Date.now()})+'\n');await page.keyboard.down(key);try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}}
async function state(){await press('1');return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
async function phase(label){const s=await state();report.phases.push({label,time:s.time,player:s.player,kills:s.kills,quest:s.quest});await page.screenshot({path:`${out}/${label}.jpg`,type:'jpeg',quality:85});console.log(label,s.kills,s.player.hp);return s;}
try{
 await page.goto(`http://127.0.0.1:4190/dist/${name}/tidelands-local/`);await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);await page.click('#start-button');await page.click('#pause-button');
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles(history);await page.waitForFunction(()=>!document.querySelector('#panel').open);
 let s=await phase('00-start');if(mode==='camp'){const initial={...s.player};for(const [key,ms]of [['d',650],['w',450],['a',650],['s',300]])await walk(key,ms);s=await phase('01-camp-walk');assert.equal(s.kills,20);assert.equal(s.player.hp,100);assert(Math.hypot(s.player.x-initial.x,s.player.z-initial.z)>.1);assert.equal(s.quest,6);}else{assert.equal(s.kills,19);await walk('a',1000);s=await phase('01-downhill');assert(s.player.x< -114);
 for(let i=0;i<16&&s.kills===19;i++){
  const e=s.enemies.find(e=>e.id==='enemy-10'),dx=e.x-s.player.x,dz=e.z-s.player.z,x=dx*Math.cos(.15)-dz*Math.sin(.15),z=dx*Math.sin(.15)+dz*Math.cos(.15);
  await walk(Math.abs(x)>Math.abs(z)?x>0?'d':'a':z>0?'s':'w',80);await press('2');await press('Space');await page.waitForTimeout(660);s=await state();
 }
 assert.equal(s.kills,20);await phase('02-combat');await press('3');await page.waitForTimeout(550);s=await phase('03-food');assert.equal(s.player.hp,100);}
 await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();const saved=await page.evaluate(key=>localStorage.getItem(key),key);fs.writeFileSync(`${out}/final-save.json`,saved);
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);report.reloadExact=true;
 assert.equal(await page.evaluate(()=>document.querySelector('#world').getContext('webgl2').getError()),0);assert.deepEqual(report.logs,[]);report.complete=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.stack);}finally{
 await context.close();report.video=await video.path();await browser.close();assert.equal(sha(fs.readFileSync(history)),report.historySha256);fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
}
