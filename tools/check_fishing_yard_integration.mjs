// Whole settlement comparison and declared legacy fixtures; never writes ordinary progress.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const out=process.argv[2]??'dist/fishing-yard-integration-2026-11-15',baseline='dist/tidelands-m5-2026-11-15-settlement/tidelands-local';assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),report={complete:false,rows:[],logs:[],source:Object.fromEntries(['scene','game','fishing-yard','fishing-yard-layout','meadow','settlement-ground'].map(n=>[n,sha(fs.readFileSync(`src/${n}.js`))])),scope:'Declared fixed-camera/time no-storage scene and copied legacy fixtures. Separate limited fixed-scene Metal GPU samples. Not ordinary input, long-term budget, physical phone, audio or complete 3A acceptance.'};
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
 for(const width of [1280,390])for(const variant of ['baseline','current']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:800}});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:4190')return route.abort();
   if(variant==='baseline'&&/^\/src\/[^/]+\.js$/.test(u.pathname)&&fs.existsSync(baseline+u.pathname))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(baseline+u.pathname,'utf8')});
   if(u.pathname==='/tests/regional-landform-review.html'){
    let code=fs.readFileSync('tests/regional-landform-review.html','utf8').replace('coast:[-130,20],forest:[164.4377,-108.4654],highland:[-41.4534111,-208.3750763]','coast:[-30,87],forest:[-40,92],highland:[-46,86]').replace('view.renderer.render(view.scene,view.camera);','view.finish.render(view.scene,view.camera);');
    code=code.replace('window.regionalReview={reset,snapshot,move,sites};',`window.regionalReview={reset,snapshot,move,sites};window.yardReview={view,getState:()=>state,fixedDraw,legacy(type){state=freshGame();state.time=240;state.quest=6;state.enemies.forEach(e=>e.hp=0);if(type==='player')Object.assign(state.player,{x:-33,z:77});else state.buildings.push({id:'legacy-yard-fixture',type,x:-33,z:77});const before=serialize(state);view.sync(state);view.draw(state,null,null,false,0);saved=before;fixedDraw();return {visible:view.fishingYard?.root.visible,stateUnchanged:serialize(state)===before,buildings:state.buildings};}};`);
    return route.fulfill({contentType:'text/html',body:code});
   }return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['error','warning'].includes(e.type()))report.logs.push(e.text());});
  await page.goto('http://127.0.0.1:4190/tests/regional-landform-review.html');await page.waitForFunction(()=>!!window.yardReview,undefined,{timeout:90000});
  for(const [site,distance]of [['coast','near'],['highland','middle'],['forest','middle']]){
   const row=await page.evaluate(([site,distance])=>{window.regionalReview.reset(site,distance);const {view}=window.yardReview;return {...window.regionalReview.snapshot(),yardVisible:view.fishingYard?.root.visible,supportGaps:view.fishingYard?.posts.map(p=>p.foot-view.groundHeight(p.x,p.z))};},[site,distance]);assert(row.worldUnchanged&&row.stateUnchanged&&row.glError===0);if(variant==='current')assert.equal(row.yardVisible,true);
   const image=`${width}-${site}-${variant}.jpg`;await page.screenshot({path:path.join(out,image),type:'jpeg',quality:88});report.rows.push({width,variant,site,...row,image,sha256:sha(fs.readFileSync(path.join(out,image)))});
  }
  const night=await page.evaluate(()=>{window.regionalReview.reset('coast','near');const {view,getState,fixedDraw}=window.yardReview;getState().time=900;view.draw(getState(),null,null,false,0);fixedDraw();return {glError:view.renderer.getContext().getError(),yardVisible:view.fishingYard?.root.visible};});assert.equal(night.glError,0);
  const image=`${width}-night-${variant}.jpg`;await page.screenshot({path:path.join(out,image),type:'jpeg',quality:88});report.rows.push({width,variant,site:'night',...night,image,sha256:sha(fs.readFileSync(path.join(out,image)))});
  if(variant==='current'){
   for(const type of ['tent','workbench','campfire','player']){const row=await page.evaluate(type=>window.yardReview.legacy(type),type);assert.equal(row.visible,false);assert(row.stateUnchanged);report.rows.push({width,variant,kind:'legacy',type,...row});}
   const restored=await page.evaluate(()=>{window.regionalReview.reset('coast','near');return window.yardReview.view.fishingYard.root.visible;});assert(restored);
  }
  const gpu=await page.evaluate(async()=>{
   const {view,fixedDraw}=window.yardReview;window.regionalReview.reset('coast','near');const gl=view.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)return {supported:false};
   for(let i=0;i<12;i++){fixedDraw();await new Promise(requestAnimationFrame);}const samples=[];
   for(let i=0;i<40;i++){const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);fixedDraw();gl.endQuery(ext.TIME_ELAPSED_EXT);for(let j=0;!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&j<120;j++)await new Promise(requestAnimationFrame);if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)||gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('GPU sample unavailable/disjoint');samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}
   samples.sort((a,b)=>a-b);const before={...view.renderer.info.memory};view.fishingYard?.release();view.fishingYard?.release();fixedDraw();return {supported:true,samples,median:samples[20],p95:samples[38],max:samples.at(-1),beforeRelease:before,afterRelease:{...view.renderer.info.memory},glError:gl.getError()};
  });if(gpu.supported)assert.equal(gpu.glError,0);report.rows.push({width,variant,kind:'GPU',...gpu});assert.equal(await page.evaluate(()=>localStorage.length),0);await context.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({width,variant,p95:gpu.p95}));
 }
 assert.deepEqual(report.logs,[]);report.complete=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.stack);}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
