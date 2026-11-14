// No-storage, same-camera settlement comparison, using a copy of the actual camp save.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const out=process.argv[2]??'dist/settlement-ground-2026-11-15';assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),sha=b=>createHash('sha256').update(b).digest('hex');
const baseline='07b731ffbec461ec87b8176a25a286d90c8676dd',oldFiles=Object.fromEntries(['ground-surface','meadow'].map(n=>[`/src/${n}.js`,execFileSync('git',['show',`${baseline}:src/${n}.js`],{encoding:'utf8'})]));
const report={baseline,rows:[],logs:[],complete:false,scope:'Same-camera no-storage fixtures using a copy of our own ordinary camp save; positions/time declared, enemies disabled. No ordinary movement, GPU or physical-device proof.'};
const preferred=JSON.parse(fs.readFileSync('docs/main-mix-2026-11-05/camp-final-save.json'));
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
 for(const width of [1280,390])for(const variant of ['baseline','current']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:800}});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:4190')return r.abort();if(variant==='baseline'&&oldFiles[u.pathname])return r.fulfill({contentType:'text/javascript',body:oldFiles[u.pathname]});if(u.pathname==='/tests/regional-landform-review.html'){
   const code=fs.readFileSync('tests/regional-landform-review.html','utf8')
    .replace('coast:[-130,20],forest:[164.4377,-108.4654],highland:[-41.4534111,-208.3750763]','coast:[-70,108],forest:[-46,86],highland:[-61,94]')
    .replace('state=freshGame();',`state=structuredClone(${JSON.stringify(preferred)});`)
    .replace('view.renderer.render(view.scene,view.camera);','view.finish.render(view.scene,view.camera);');
   return r.fulfill({contentType:'text/html',body:code});
  }return r.continue();});
  const page=await context.newPage();page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
  await page.goto('http://127.0.0.1:4190/tests/regional-landform-review.html');await page.waitForFunction(()=>!!window.regionalReview,undefined,{timeout:90000});
  for(const site of ['coast','highland','forest']){
   const row=await page.evaluate(site=>window.regionalReview.reset(site,'near'),site);assert(row.worldUnchanged&&row.stateUnchanged&&row.glError===0);
   const image=`${width}-${site}-${variant}.jpg`;await page.screenshot({path:path.join(out,image),type:'jpeg',quality:89});report.rows.push({width,variant,...row,image,sha256:sha(fs.readFileSync(path.join(out,image)))});
  }
  assert.equal(await page.evaluate(()=>localStorage.length),0);await context.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({width,variant}));
 }
 for(const a of report.rows.filter(x=>x.variant==='current')){const b=report.rows.find(x=>x.variant==='baseline'&&x.width===a.width&&x.site===a.site);assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.lookAt,b.lookAt);}
 assert.deepEqual(report.logs,[]);report.complete=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.stack);}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
