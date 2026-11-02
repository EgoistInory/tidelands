// Local, isolated visual comparison. Requires the existing Playwright runtime; installs nothing.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import * as current from '../src/world.js';
const root=fileURLToPath(new URL('..',import.meta.url)),sha=data=>createHash('sha256').update(data).digest('hex');
const output=path.resolve(process.argv[2]??path.join(root,'dist/regional-landform-review-2026-11-02'));
const resume=process.argv.includes('--resume');assert(!fs.existsSync(output)||resume,'Preserve prior evidence; use a new output directory.');fs.mkdirSync(output,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const baselineRef='1ac9e2520ceb7c84b63cd64eb6272a86af4d0ac3';
const oldHelper=execFileSync('git',['show',`${baselineRef}:src/terrain-composition.js`],{cwd:root,encoding:'utf8'});
const worldSource=fs.readFileSync(path.join(root,'src/world.js'),'utf8');
const previous=await import('data:text/javascript;base64,'+Buffer.from(worldSource.replace("'./terrain-composition.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(oldHelper).toString('base64')))).toString('base64'));
const sites={coast:[-130,20],forest:[164.4377,-108.4654],highland:[-41.4534111,-208.3750763],shoal:[170,160]};
const heights=Object.fromEntries(Object.entries(sites).map(([name,[x,z]])=>[name,{before:previous.terrain(x,z),after:current.terrain(x,z),cameraGround:Math.max(previous.terrain(x,z),current.terrain(x,z))}]));
const sources=Object.fromEntries(['src/terrain-composition.js','src/inland.js','src/world.js','src/scene.js','src/game.js','tests/regional-landform-review.html'].map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const report=resume?JSON.parse(fs.readFileSync(path.join(output,'raw.json'))):{date:new Date().toISOString(),browserPath:'Browser plugin not available; bundled Playwright, isolated contexts, native Metal headless Chromium.',baselineRef,baselineHelperSha256:sha(oldHelper),sources,heights,rows:[],contexts:[],scope:'Four-island static same-camera comparisons and declared 6-second production-motion fixtures; no ordinary campaign, GPU duration, endurance, listening or device acceptance.'};
assert.deepEqual(report.sources,sources,'Resume requires the same rendered sources.');
if(resume&&report.error){fs.copyFileSync(path.join(output,'raw.json'),path.join(output,'attempt1.json'));report.attemptFailures=[report.error];delete report.error;}
let browser;
try{
 for(const config of [{variant:'before',width:1440,height:900,dpr:1},{variant:'candidate',width:1440,height:900,dpr:1},{variant:'candidate-mobile',width:390,height:844,dpr:1.5}]){
  if(resume&&report.rows.filter(r=>r.variant===config.variant).length===(config.variant==='candidate-mobile'?5:16))continue;
  browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
  const context=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.dpr});
  const logs=[],failures=[];await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin!=='http://127.0.0.1:4190'){await route.abort();return;}if(config.variant==='before'&&url.pathname==='/src/terrain-composition.js'){await route.fulfill({contentType:'text/javascript',body:oldHelper});return;}await route.continue();});
  const contextReport={...config,logs,failures};report.contexts.push(contextReport);let closing=false;
  let rejectPage;const pageFailure=new Promise((_,reject)=>{rejectPage=reject;});
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>{logs.push({type:'pageerror',message:e.message});rejectPage(e);});page.on('console',e=>{if(['warning','error'].includes(e.type()))logs.push({type:e.type(),message:e.text()});});page.on('requestfailed',r=>failures.push({url:r.url(),failure:r.failure(),closing}));
  console.log(JSON.stringify({variant:config.variant,phase:'loading'}));
  await Promise.race([(async()=>{await page.goto('http://127.0.0.1:4190/tests/regional-landform-review.html');await page.waitForFunction(()=>!!window.regionalReview);})(),pageFailure]);
  Object.assign(contextReport,{url:page.url(),title:await page.title(),meaningfulBody:(await page.locator('body').innerText()).includes('四岛同镜头')});
  for(const site of Object.keys(sites)){
   for(const distance of config.variant==='candidate-mobile'?['middle']:['near','middle','far']){
    const row=await page.evaluate(({site,distance,height})=>window.regionalReview.reset(site,distance,height),{site,distance,height:heights[site].cameraGround});
    assert.equal(row.glError,0);assert(row.worldUnchanged&&row.stateUnchanged);assert(Object.values(row.authored).every(Boolean));
    const image=`${config.variant}-${site}-${distance}.png`;await page.screenshot({path:path.join(output,image)});report.rows.push({variant:config.variant,kind:'static',image,sha256:sha(fs.readFileSync(path.join(output,image))),...row});
    console.log(JSON.stringify({variant:config.variant,site,distance,buffer:row.buffer,glError:row.glError}));
   }
   if(config.variant!=='candidate-mobile'||site==='highland'){
    await page.selectOption('#site',site);await page.selectOption('#distance','middle');await page.click('#move');await page.waitForFunction(()=>window.regionalReview.snapshot().motion?.complete);
    const row=await page.evaluate(()=>window.regionalReview.snapshot());const image=`${config.variant}-${site}-motion.png`;await page.screenshot({path:path.join(output,image)});report.rows.push({variant:config.variant,kind:'motion',image,sha256:sha(fs.readFileSync(path.join(output,image))),...row});
    console.log(JSON.stringify({variant:config.variant,site,motion:row.motion,glError:row.glError}));
   }
  }
  contextReport.failuresBeforeClose=[...failures];closing=true;await context.close();await browser.close();browser=null;fs.writeFileSync(path.join(output,'raw.json'),JSON.stringify(report,null,2)+'\n');
 }
 for(const row of report.rows.filter(r=>r.variant==='before'&&r.kind==='static')){const after=report.rows.find(r=>r.variant==='candidate'&&r.site===row.site&&r.distance===row.distance&&r.kind==='static');assert.deepEqual(row.camera,after.camera);assert.deepEqual(row.lookAt,after.lookAt);assert.deepEqual(row.buffer,after.buffer);}
 report.complete=true;report.cleanConsole=report.contexts.every(c=>c.logs.length===0);fs.writeFileSync(path.join(output,'raw.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({complete:true,output,rows:report.rows.length,cleanConsole:report.cleanConsole}));
}catch(error){report.error=error.stack;fs.writeFileSync(path.join(output,'raw.json'),JSON.stringify(report,null,2)+'\n');throw error;}finally{await browser?.close();}
