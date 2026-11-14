import {execFileSync} from 'node:child_process';
// Fixed scene fixtures, identical cameras and state; not an ordinary gameplay acceptance.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out=process.argv[2]??'dist/atmosphere-finish-2026-11-15';assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),sha=b=>createHash('sha256').update(b).digest('hex');
const oldFiles=Object.fromEntries(['scene','sky'].map(n=>[`/src/${n}.js`,execFileSync('git',['show',`836538b:src/${n}.js`],{encoding:'utf8'})]));
const report={baseline:'836538b',sourceSha256:sha(fs.readFileSync('src/scene-finish.js')),rows:[],logs:[],complete:false,scope:'No-storage frozen world fixtures; identical cameras; day and night QA clock fixtures. Separate bounded GPU timings. Not ordinary journey, sound, physical phone, full performance or AAA acceptance.'};
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
 for(const width of [1280,390])for(const variant of ['baseline','current']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:800},deviceScaleFactor:1});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:4190')return r.abort();if(variant==='baseline'&&oldFiles[u.pathname])return r.fulfill({contentType:'text/javascript',body:oldFiles[u.pathname]});if(u.pathname==='/tests/regional-landform-review.html'){
   const source=fs.readFileSync('tests/regional-landform-review.html','utf8').replace('view.renderer.render(view.scene,view.camera);','if(view.finish)view.finish.render(view.scene,view.camera);else view.renderer.render(view.scene,view.camera);').replace('window.regionalReview={reset,snapshot,move,sites};','window.regionalReview={reset,snapshot,move,sites};window.finishReview={view,fixedDraw,getState:()=>state};');
   return r.fulfill({contentType:'text/html',body:source});
  }return r.continue();});
  const page=await context.newPage();page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['error','warning'].includes(e.type()))report.logs.push(e.text());});
  await page.goto('http://127.0.0.1:4190/tests/regional-landform-review.html');await page.waitForFunction(()=>!!window.finishReview,undefined,{timeout:90000});
  for(const site of ['coast','forest','highland','shoal'])for(const enabled of [variant==='current']){
   const row=await page.evaluate(([site,enabled])=>{const {view}=window.finishReview;if(view.finish)view.finish.enabled=enabled;window.regionalReview.reset(site,'middle');const r=window.regionalReview.snapshot();return {...r,finish:enabled,targetSize:view.finish?.enabled??false,resources:view.renderer.info.memory};},[site,enabled]);
   assert(row.worldUnchanged&&row.stateUnchanged&&row.glError===0);const image=`${width}-${site}-${enabled?'finish':'baseline'}.jpg`;await page.screenshot({path:path.join(out,image),type:'jpeg',quality:89});report.rows.push({...row,image,sha256:sha(fs.readFileSync(path.join(out,image)))});
  }
  for(const enabled of [variant==='current']){
   const row=await page.evaluate(enabled=>{const {view,getState,fixedDraw}=window.finishReview;if(view.finish)view.finish.enabled=enabled;window.regionalReview.reset('coast','near');const state=getState();state.time=900;view.draw(state,null,null,false,0);fixedDraw();return {finish:enabled,glError:view.renderer.getContext().getError(),camera:view.camera.position.toArray()};},enabled);
   assert.equal(row.glError,0);const image=`${width}-night-${enabled?'finish':'baseline'}.jpg`;await page.screenshot({path:path.join(out,image),type:'jpeg',quality:89});report.rows.push({...row,width,site:'night',image,sha256:sha(fs.readFileSync(path.join(out,image)))});
  }
  const perf=await page.evaluate(async(variant)=>{
   const {view,fixedDraw}=window.finishReview,gl=view.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)return {supported:false};const rows=[];
   window.regionalReview.reset('coast','middle');
   for(const enabled of [variant==='current']){
    if(view.finish)view.finish.enabled=enabled;for(let i=0;i<12;i++){fixedDraw();await new Promise(requestAnimationFrame);}
    const samples=[];
    for(let i=0;i<40;i++){
     const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);fixedDraw();gl.endQuery(ext.TIME_ELAPSED_EXT);
     for(let attempt=0;!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&attempt<120;attempt++)await new Promise(requestAnimationFrame);
     if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))throw Error('GPU query timeout');if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('GPU disjoint');samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
    }
    samples.sort((a,b)=>a-b);rows.push({enabled,median:samples[20],p95:samples[38],max:samples.at(-1),samples});
   }
   const before={...view.renderer.info.memory};view.finish?.dispose();view.finish?.dispose();fixedDraw();return {supported:true,rows,beforeDispose:before,afterDispose:{...view.renderer.info.memory},glError:gl.getError()};
  },variant);report.rows.push({width,variant,kind:'GPU',...perf});assert.equal(await page.evaluate(()=>localStorage.length),0);await context.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({width,perf}));
 }
 assert.deepEqual(report.logs,[]);report.complete=true;
}catch(e){report.error=e.stack;console.error(e.stack);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
