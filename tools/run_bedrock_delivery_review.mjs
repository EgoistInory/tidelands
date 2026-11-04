// Before/after actual source renderers; explicit no-storage scene/motion fixtures.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import * as current from '../src/world.js';
const root=fileURLToPath(new URL('..',import.meta.url)),out=path.resolve(process.argv[2]??'dist/bedrock-delivery-review-2026-11-05'),sha=b=>createHash('sha256').update(b).digest('hex');assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const ref='aa63d205b3b4cceb971c1b15a004d2198a572b44',oldFiles=Object.fromEntries(['world','game','scene','meadow'].map(n=>[`/src/${n}.js`,execFileSync('git',['show',`${ref}:src/${n}.js`],{cwd:root,encoding:'utf8'})]));
const resolved=oldFiles['/src/world.js'].replace(/from '([^']+)'/g,(_m,p)=>`from '${new URL('../src/'+p,import.meta.url).href}'`),oldWorld=await import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
const sites={coast:[-130,20],forest:[164.4377,-108.4654],highland:[-41.4534111,-208.3750763],shoal:[170,160]},heights=Object.fromEntries(Object.entries(sites).map(([k,[x,z]])=>[k,Math.max(oldWorld.terrain(x,z),current.terrain(x,z))]));
assert.deepEqual(current.createWorld().objects.map(({y,...o})=>o),oldWorld.createWorld().objects.map(({y,...o})=>o));
const sources=['src/world.js','src/terrain-grid.js','src/bedrock-terrain.js','src/scene.js','src/game.js','src/meadow.js','tests/regional-landform-review.html','tools/run_bedrock_delivery_review.mjs'];
const report={baselineRef:ref,oldSourceSha256:Object.fromEntries(Object.entries(oldFiles).map(([p,s])=>[p,sha(s)])),sourceSha256:Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),heights,rows:[],contexts:[],scope:'Before/after source WorldView, fixed scene fixtures with inactive enemies/quest6/time240 and identical comparison cameras. Production movement functions for one declared 6-simulation-second highland fixture. No ordinary inputs, real device, audition or GPU timing claim.'};
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');let browser;
try{
 browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
 for(const width of [1280,390])for(const variant of ['baseline','current']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:800},deviceScaleFactor:1,...(width===1280&&variant==='current'?{recordVideo:{dir:out,size:{width:960,height:600}}}:{})}),logs=[],failures=[],record={width,variant,logs,failures};report.contexts.push(record);
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:4190')return route.abort();if(variant==='baseline'&&oldFiles[u.pathname])return route.fulfill({contentType:'text/javascript',body:oldFiles[u.pathname]});return route.continue();});
  const page=await context.newPage(),video=page.video();page.setDefaultTimeout(90000);page.on('pageerror',e=>logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))logs.push(e.text());});page.on('requestfailed',r=>failures.push({url:r.url(),failure:r.failure()}));
  await page.goto('http://127.0.0.1:4190/tests/regional-landform-review.html');await page.waitForFunction(()=>!!window.regionalReview);
  const cases=width===390?[['coast','middle'],['highland','middle']]:[...Object.keys(sites).map(s=>[s,'middle']),['highland','near']];
  for(const [site,distance]of cases){const row=await page.evaluate(([s,d,h])=>window.regionalReview.reset(s,d,h),[site,distance,heights[site]]);assert(row.worldUnchanged&&row.stateUnchanged&&row.glError===0&&Object.values(row.authored).every(Boolean));const image=`${width}-${variant}-${site}-${distance}.png`;await page.screenshot({path:path.join(out,image)});report.rows.push({width,variant,kind:'static',image,sha256:sha(fs.readFileSync(path.join(out,image))),...row});}
  if(width===1280&&variant==='current'){
   await page.evaluate(h=>window.regionalReview.reset('highland','middle',h),heights.highland);record.motionWallStart=Date.now();await page.click('#move');await page.waitForFunction(()=>window.regionalReview.snapshot().motion?.complete);record.motionWallEnd=Date.now();const row=await page.evaluate(()=>window.regionalReview.snapshot());assert(row.glError===0&&row.motion.frames===360&&row.motion.distance>1);const image='1280-current-highland-motion.png';await page.screenshot({path:path.join(out,image)});report.rows.push({width,variant,kind:'motion',image,sha256:sha(fs.readFileSync(path.join(out,image))),...row});
  }
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(logs,[]);assert(failures.every(f=>f.failure?.errorText==='net::ERR_ABORTED'));await context.close();if(video){record.video=path.relative(out,await video.path());record.videoSha256=sha(fs.readFileSync(path.join(out,record.video)));}
  fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({width,variant,rows:report.rows.length,logs:logs.length}));
 }
 for(const a of report.rows.filter(r=>r.variant==='current'&&r.kind==='static')){const b=report.rows.find(r=>r.variant==='baseline'&&r.width===a.width&&r.site===a.site&&r.distance===a.distance);for(const k of ['camera','lookAt','buffer'])assert.deepEqual(a[k],b[k]);}
 report.complete=true;
}catch(e){report.error=e.stack;throw e;}finally{await browser?.close();fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({complete:true,rows:report.rows.length,out}));
