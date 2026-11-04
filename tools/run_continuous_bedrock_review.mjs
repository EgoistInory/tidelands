import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),out=process.argv[2]??'dist/continuous-bedrock-2026-11-05',sha=b=>createHash('sha256').update(b).digest('hex');
assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const original=fs.readFileSync('src/world.js','utf8');assert(original.includes('export function terrain(x,z){'));
const modified="import {continuousBedrockHeight} from '/tests/continuous-bedrock-candidate.js';\n"+original.replace('export function terrain(x,z){','function baseTerrain(x,z){')+'\nexport function terrain(x,z){return continuousBedrockHeight(x,z,baseTerrain(x,z),ISLANDS,protectedCompositionSites);}';
const sources=['src/world.js','src/scene.js','src/game.js','src/landscape.js','tests/continuous-bedrock-candidate.js','tests/continuous-bedrock-review.html','tools/run_continuous_bedrock_review.mjs'];
const report={sources:Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(p))])),modifiedWorldSha256:sha(modified),rows:[],contexts:[],scope:'Isolated authority-height and terrain-shadow study on copied ordinary saves. World module route replacement declared. Not native inputs, movement/contact, old-camp, GPU timing or M5 acceptance.'};let browser;
try{
 browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
 for(const width of [1280,390])for(const variant of ['baseline','candidate']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:800},deviceScaleFactor:1}),logs=[],failures=[];report.contexts.push({width,variant,logs,failures});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:4190')return r.abort();if(variant==='candidate'&&u.pathname==='/src/world.js')return r.fulfill({contentType:'text/javascript',body:modified});return r.continue();});
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))logs.push(e.text());});page.on('requestfailed',r=>failures.push({url:r.url(),failure:r.failure()}));
  await page.goto('http://127.0.0.1:4190/tests/continuous-bedrock-review.html?variant='+variant);await page.waitForFunction(()=>!!window.continuousReview);
  for(const [site,distance]of width===390?[['highland','ordinary']]:[['highland','ordinary'],['highland','overview'],['camp','ordinary']]){
   const row=await page.evaluate(([s,d])=>window.continuousReview.reset(s,d),[site,distance]);assert(row.worldUnchanged&&row.stateUnchanged&&row.glError===0&&Object.values(row.authored).every(Boolean)&&row.textures.every(s=>s==='ready'));assert.equal(row.variant,variant);
   const image=`${width}-${site}-${distance}-${variant}.png`;await page.locator('canvas').screenshot({path:path.join(out,image)});report.rows.push({...row,image,sha256:sha(fs.readFileSync(path.join(out,image)))});console.log(JSON.stringify({width,variant,site,distance,calls:row.render.calls}));
  }
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.deepEqual(logs,[]);assert(failures.every(f=>f.failure?.errorText==='net::ERR_ABORTED'));await context.close();
 }
 for(const a of report.rows.filter(r=>r.variant==='candidate')){
  const b=report.rows.find(r=>r.variant==='baseline'&&r.site===a.site&&r.distance===a.distance&&r.viewport[0]===a.viewport[0]);
  for(const k of ['camera','lookAt','buffer','time','player','ground'])assert.deepEqual(a[k],b[k],k);
 }
 report.complete=true;
}catch(e){report.error=e.stack;throw e;}finally{await browser?.close();fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({complete:true,rows:report.rows.length,out}));
