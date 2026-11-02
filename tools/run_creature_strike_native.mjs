// Actual packaged main with native inputs and video; one ordinary-save copy per context.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const out=process.argv[2]??'dist/creature-strike-package-native-2026-11-03',entry=process.argv[3]??'http://127.0.0.1:4190/dist/tidelands-m5-2026-11-03-creature-strike/tidelands-local/';
assert(new URL(entry).origin==='http://127.0.0.1:4190'&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),backup=fs.readFileSync('docs/beacon-footing-normal-save.json','utf8'),before=JSON.parse(backup);
const report={entry,backupSha256:sha(backup),rows:[],logs:[],runtimeOutsideBase:[],sources:Object.fromEntries(['src/creature.js','src/game.js','src/action-timing.js','src/actor-contact.js','src/main.js'].map(p=>[p,sha(fs.readFileSync(p))])),scope:'Native real main and existing enemies on independent copies of one historical ordinary export. No gameplay injections after initialization, no teleports or enemy reset. Browser mobile dimensions, not physical device. Videos have not been auditioned; no full campaign/GPU/endurance or complete natural-contact acceptance.'};
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
 for(const [name,viewport]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
  const row={name,viewport,images:[]};report.rows.push(row);
  const context=await browser.newContext({viewport,recordVideo:{dir:out,size:viewport}});let video;
  try{
   await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());
   await context.addInitScript(raw=>{
    if(!sessionStorage.getItem('strike-copy')){localStorage.setItem('tidelands-save-v1',raw);sessionStorage.setItem('strike-copy','1');}
    window.strikeEvents=[];document.addEventListener('DOMContentLoaded',()=>{
     const sample=()=>window.strikeEvents.push({at:performance.now(),hp:Number(document.querySelector('#hp').value),danger:document.querySelector('#enemy-status').dataset.danger??null,enemy:document.querySelector('#enemy-hp-value').textContent,attack:document.querySelector('#attack-feedback').textContent,hurt:document.querySelector('#hurt-feedback').textContent});
     const observer=new MutationObserver(sample);for(const id of ['enemy-status','enemy-hp-value','hp-value','combat-feedback'])observer.observe(document.getElementById(id),{attributes:true,childList:true,subtree:true,characterData:true});sample();
    });
   },backup);
   const page=await context.newPage();video=page.video();page.setDefaultTimeout(60000);
   page.on('request',r=>{const url=r.url();if(new URL(url).origin==='http://127.0.0.1:4190'&&!url.startsWith(entry))report.runtimeOutsideBase.push(url);});
   page.on('pageerror',e=>report.logs.push(name+': '+e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(name+': '+e.text());});
   await page.goto(entry);await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert((await page.title()).includes('潮生群岛'));assert.equal(await page.locator('#load-status').textContent(),'群岛已就绪 · 无需联网');
   row.manifestCreatureSha256=await page.evaluate(async()=>{const manifest=await(await fetch('delivery-manifest.json')).json();return manifest.files['src/creature.js'].sha256;});assert.equal(row.manifestCreatureSha256,report.sources['src/creature.js']);
   await page.click('#start-button');await page.keyboard.press('2');
   for(const [key,ms]of [['d',1200],['w',3300]]){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}await page.waitForTimeout(1800);
   async function sample(){return page.evaluate(()=>({at:performance.now(),hp:Number(document.querySelector('#hp').value),danger:document.querySelector('#enemy-status').dataset.danger,attack:document.querySelector('#attack-feedback').textContent,hurt:document.querySelector('#hurt-feedback').textContent,food:Number(document.querySelector('#food-count').textContent),hidden:document.hidden,glError:document.querySelector('#world').getContext('webgl2').getError()}));}
   async function capture(phase,data){const image=name+'-'+phase+'.png';await page.screenshot({path:path.join(out,image)});row.images.push({phase,...data,image,sha256:sha(fs.readFileSync(path.join(out,image)))});}
   const captured=new Set();
   for(let i=0;i<8;i++){
    if(name==='mobile')await page.click('#attack-button');else await page.keyboard.press('Space');
    for(let n=0;n<8;n++){
     await page.waitForTimeout(100);const data=await sample();assert(!data.hidden&&data.glError===0);
     for(const [phase,condition]of [['windup',data.danger==='windup'],['hurt',data.hp<before.player.hp],['hit',data.attack.includes('命中')&&!data.attack.includes('未命中')]])if(condition&&!captured.has(phase)){await capture(phase,data);captured.add(phase);}
    }
   }
   assert(captured.has('windup')&&captured.has('hurt')&&captured.has('hit'));
   row.beforeFood=await sample();await page.keyboard.press('3');row.afterFood=await sample();assert.equal(row.afterFood.food,row.beforeFood.food-1);await page.keyboard.press('2');
   await page.keyboard.down('s');await page.waitForTimeout(2000);await page.keyboard.up('s');await capture('withdraw',await sample());
   row.events=await page.evaluate(()=>window.strikeEvents);await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();row.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tidelands-save-v1')));
   assert(row.saved.kills>before.kills&&row.saved.quest===before.quest);assert.deepEqual(row.saved.buildings,before.buildings);
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('tidelands-save-v1'))),row.saved);row.reloadExact=true;
  }finally{await context.close();if(video){row.video=path.basename(await video.path());row.videoSha256=sha(fs.readFileSync(path.join(out,row.video)));}}
  console.log(JSON.stringify({name,kills:row.saved.kills,hp:row.saved.player.hp,images:row.images.length,video:row.video,reloadExact:row.reloadExact}));
 }
 assert.equal(report.logs.length,0);assert.equal(report.runtimeOutsideBase.length,0);report.complete=true;
}catch(e){report.error=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
