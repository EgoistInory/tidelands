// Fixed-camera, no-storage visual fixtures derived from our ordinary camp save.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out=process.argv[2]??'dist/fishing-yard-review-2026-11-15';assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),sha=b=>createHash('sha256').update(b).digest('hex');
const report={rows:[],logs:[],complete:false,sourceSha256:sha(fs.readFileSync('tools/fishing_yard_candidate.js')),scope:'Fixed camera/time/position no-storage fixtures from a copy of our own ordinary camp save. Not ordinary movement, collision, GPU, physical phone, or final composition acceptance.'};
const preferred=JSON.parse(fs.readFileSync('docs/main-mix-2026-11-05/camp-final-save.json'));
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:800}});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:4190')return r.abort();if(u.pathname==='/tests/regional-landform-review.html'){
   let code=fs.readFileSync('tests/regional-landform-review.html','utf8');
   code=code.replace("import * as THREE", "import {createFishingYardCandidate} from '../tools/fishing_yard_candidate.js';\nimport * as THREE")
    .replace('coast:[-130,20],forest:[164.4377,-108.4654],highland:[-41.4534111,-208.3750763]','coast:[-30,87],forest:[-40,92],highland:[-46,86]')
    .replace('state=freshGame();',`state=structuredClone(${JSON.stringify(preferred)});`)
    .replace('view.renderer.render(view.scene,view.camera);','view.finish.render(view.scene,view.camera);')
    .replace('window.regionalReview={reset,snapshot,move,sites};',`window.regionalReview={reset,snapshot,move,sites};const candidate=createFishingYardCandidate({x:-33,z:77},view.groundHeight);view.scene.add(candidate.root);window.routeReview={toggle(enabled){candidate.root.visible=enabled;fixedDraw();return {enabled,boxCount:candidate.boxes.length,postCount:candidate.posts.length,buildings:state.buildings,camera:view.camera.position.toArray(),glError:gl.getError(),render:view.renderer.info.render.calls};}};`);
   return r.fulfill({contentType:'text/html',body:code});
  }return r.continue();});
  const page=await context.newPage();page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
  await page.goto('http://127.0.0.1:4190/tests/regional-landform-review.html');await page.waitForFunction(()=>!!window.routeReview,undefined,{timeout:90000});
  for(const site of ['coast','highland','forest'])for(const enabled of [false,true]){
   const row=await page.evaluate(([site,enabled])=>{window.regionalReview.reset(site,site==='coast'?'near':'middle');const info=window.routeReview.toggle(enabled);return {...window.regionalReview.snapshot(),...info};},[site,enabled]);assert(row.worldUnchanged&&row.stateUnchanged&&row.glError===0);
   const image=`${width}-${site}-${enabled?'candidate':'baseline'}.jpg`;await page.screenshot({path:path.join(out,image),type:'jpeg',quality:89});report.rows.push({width,site,enabled,...row,image,sha256:sha(fs.readFileSync(path.join(out,image)))});
  }
  assert.equal(await page.evaluate(()=>localStorage.length),0);await context.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({width,rows:report.rows.length}));
 }
 assert.deepEqual(report.logs,[]);report.complete=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.stack);}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
