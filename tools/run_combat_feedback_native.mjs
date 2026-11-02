// Real local main, isolated ordinary-save copies. No gameplay state injection after load.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const root=fileURLToPath(new URL('..',import.meta.url));
const out=path.resolve(process.argv[2]??path.join(root,'dist/combat-feedback-native-2026-11-03'));
const entry=process.argv[3]??'http://127.0.0.1:4190/';
const names=(process.argv[4]??'desktop,mobile').split(',');assert(names.length&&names.every(n=>['desktop','mobile'].includes(n)));
assert.equal(new URL(entry).origin,'http://127.0.0.1:4190');
assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const backup=fs.readFileSync(path.join(root,'docs/beacon-footing-normal-save.json'),'utf8');
const report={entry,runnerSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),backupSha256:sha(backup),sources:Object.fromEntries(['src/main.js','index.html','styles.css'].map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),rows:[],logs:[],runtimeOutsideBase:[],scope:'Independent copies of one historical ordinary export. Native movement, attacks, food, pause/save/reload. No injected enemies/materials/time/teleports after initial copy. Browser-sized mobile is not physical-device proof. No full campaign, GPU/endurance or audio quality claim.'};
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
 for(const [name,viewport]of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]].filter(([name])=>names.includes(name))){
  const context=await browser.newContext({viewport});
  try{
   await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());
   await context.addInitScript(raw=>{
    if(!sessionStorage.getItem('feedback-copy')){localStorage.setItem('tidelands-save-v1',raw);sessionStorage.setItem('feedback-copy','1');}
    window.feedbackRecords=[];
    document.addEventListener('DOMContentLoaded',()=>{
     const ids=['combat-feedback','attack-feedback','hurt-feedback','damage-feedback'];
     const sample=()=>{const row={at:performance.now()};for(const id of ids){const e=document.getElementById(id);row[id]={text:e.textContent,hidden:e.hidden,kind:e.dataset.kind??null};}window.feedbackRecords.push(row);};
     const observer=new MutationObserver(sample);for(const id of ids)observer.observe(document.getElementById(id),{attributes:true,childList:true,subtree:true,characterData:true});sample();
    });
   },backup);
   const page=await context.newPage();page.setDefaultTimeout(60000);
   page.on('request',r=>{const url=r.url();if(new URL(url).origin==='http://127.0.0.1:4190'&&!url.startsWith(entry))report.runtimeOutsideBase.push(url);});
   page.on('pageerror',e=>report.logs.push(name+': '+e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(name+': '+e.text());});
   await page.goto(entry);await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
   assert.equal(await page.locator('#load-status').textContent(),'群岛已就绪 · 无需联网');
   assert((await page.title()).includes('潮生'));
   await page.click('#start-button');await page.keyboard.press('2');
   for(const [key,ms]of [['d',1200],['w',3300]]){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
   await page.waitForTimeout(1800);let overlapImage=null,killImage=null;
   async function capture(image){
    const layout=await page.evaluate(()=>Object.fromEntries(['attack-feedback','hurt-feedback','toast','interact-button'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return [id,{text:e.textContent,hidden:e.hidden,rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}];})));
    await page.screenshot({path:path.join(out,image)});return {image,sha256:sha(fs.readFileSync(path.join(out,image))),layout};
   }
   for(let i=0;i<8;i++){
    if(name==='mobile')await page.click('#attack-button');else await page.keyboard.press('Space');
    for(let n=0;n<8;n++){
     await page.waitForTimeout(100);
     const s=await page.evaluate(()=>{const a=document.querySelector('#attack-feedback'),h=document.querySelector('#hurt-feedback');return {both:!a.hidden&&!h.hidden,kind:a.dataset.kind,text:a.textContent};});
     if(!overlapImage&&s.both&&s.kind==='hit')overlapImage=await capture(name+'-hit-and-hurt.png');
     if(!killImage&&s.text.includes('击败'))killImage=await capture(name+'-kill.png');
    }
   }
   assert(overlapImage&&killImage,'native confirmed outcome and damage must coexist');
   await page.keyboard.press('3');await page.keyboard.press('2');await page.keyboard.down('s');await page.waitForTimeout(2000);await page.keyboard.up('s');
   const records=await page.evaluate(()=>window.feedbackRecords);
   const intervals=[];
   for(let i=0;i<records.length;i++){
    const r=records[i],a=r['attack-feedback'];if(a.hidden||a.kind!=='hit'||!a.text)continue;
    if(i&&records[i-1]['attack-feedback'].text===a.text&&!records[i-1]['attack-feedback'].hidden)continue;
    const end=records.find((next,j)=>j>i&&(next['attack-feedback'].hidden||next['attack-feedback'].text!==a.text));if(!end)continue;
    const replacement=end['attack-feedback'],ms=end.at-r.at,confirmedReplacement=!replacement.hidden&&replacement.kind==='hit';
    intervals.push({text:a.text,ms,confirmedReplacement});
   }
   const result={name,overlapImage,killImage,records,intervals};report.rows.push(result);
   assert(intervals.length&&intervals.every(r=>r.confirmedReplacement||r.ms>=1000),'damage/misses must not prematurely erase confirmed outcomes; a new confirmed outcome may replace one');
   assert(intervals.some(r=>!r.confirmedReplacement&&r.ms>=1000));
   const ui=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const bounds=Object.fromEntries(['combat-feedback','attack-feedback','hurt-feedback','toast','interact-button'].map(id=>[id,rect(document.getElementById(id))]));
    return {title:document.title,viewport:[innerWidth,innerHeight],canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height],coordinates:document.querySelector('#coordinates').textContent,hp:Number(document.querySelector('#hp').value),bounds,hidden:document.hidden,glError:document.querySelector('canvas').getContext('webgl2').getError(),overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert(!ui.hidden&&!ui.overflow&&ui.glError===0);
   await page.click('#pause-button');assert(await page.locator('#combat-feedback').evaluate(e=>e.hidden));
   await page.getByRole('button',{name:'保存进度',exact:true}).click();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tidelands-save-v1')));
   assert(saved.kills>=4);assert.equal(saved.quest,6);
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('tidelands-save-v1'))),saved);
   Object.assign(result,{ui,saved,reloadExact:true});
   console.log(JSON.stringify({name,intervals,kills:saved.kills,hp:saved.player.hp,reloadExact:true}));
  }finally{await context.close();}
 }
 assert.equal(report.logs.length,0);assert.equal(report.runtimeOutsideBase.length,0);report.complete=true;
}catch(e){report.error=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
