// Isolated macro-geometry experiment on copied ordinary saves; no storage or production mutation.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),out=process.argv[2]??'dist/escarpment-embedded-2026-11-05',sha=b=>createHash('sha256').update(b).digest('hex');
assert(!fs.existsSync(out),'Keep prior evidence; choose a new output directory.');fs.mkdirSync(out,{recursive:true});
const sources=['tests/escarpment-candidate.js','tests/escarpment-scanned-candidate.js','tests/escarpment-embedded-candidate.js','tests/escarpment-embedded-review.html','tools/run_escarpment_embedded_review.mjs','src/ground-surface.js','src/scene.js','src/world.js','src/landscape.js','docs/native-campaign-2026-11-03/06-explorer-save.json','docs/native-camp-night-2026-11-04/01-camp-return-save.json','docs/native-camp-night-2026-11-04/02-natural-night-save.json'];
const report={date:new Date().toISOString(),sources:Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(p))])),rows:[],contexts:[],scope:'Frozen copied ordinary save scenes, explicit fixed camera. Isolated closed rock geometry candidate only; contacts not integrated. Not native gameplay, GPU timing, continuous motion, audition or physical-device proof.'};let browser;
try{
 browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:800},deviceScaleFactor:1}),logs=[],failures=[];report.contexts.push({width,logs,failures});
  await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4190'?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))logs.push(e.text());});page.on('requestfailed',r=>failures.push({url:r.url(),failure:r.failure()}));
  await page.goto('http://127.0.0.1:4190/tests/escarpment-embedded-review.html');await page.waitForFunction(()=>!!window.escarpmentReview);
  for(const [site,distance] of width===390?[['highland','ordinary'],['camp','ordinary']]:[['highland','ordinary'],['highland','overview'],['highland','far'],['camp','ordinary']]){
   await page.evaluate(([s,d])=>window.escarpmentReview.reset(s,d),[site,distance]);const pair=[];
   for(const variant of ['baseline','candidate']){
    const row=await page.evaluate(v=>window.escarpmentReview.setVariant(v),variant);assert(row.worldUnchanged&&row.stateUnchanged);assert.equal(row.glError,0);assert(Object.values(row.authored).every(Boolean));assert(row.textures.every(s=>s==='ready'));
    const image=`${width}-${site}-${distance}-${variant}.png`;await page.locator('canvas').screenshot({path:path.join(out,image)});pair.push(row);report.rows.push({...row,image,sha256:sha(fs.readFileSync(path.join(out,image))),screenshotTarget:'canvas'});
   }
   for(const field of ['camera','lookAt','buffer','time','player','ground'])assert.deepEqual(pair[0][field],pair[1][field],field);
   console.log(JSON.stringify({width,site,distance,calls:pair[0].render.calls}));
  }
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(logs,[]);
  // Loader promises and texture states above must resolve. Retain Chromium aborted-stream
  // diagnostics separately; do not describe the network as clean or infer their cause.
  assert(failures.every(r=>r.failure?.errorText==='net::ERR_ABORTED'));await context.close();
 }
 report.complete=true;
}catch(e){report.error=e.stack;throw e;}finally{await browser?.close();fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({complete:true,rows:report.rows.length,out}));
