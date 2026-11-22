// Observe the native file import and continue buttons on a verified extracted build.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const [name,saveFile,out]=process.argv.slice(2);
assert(/^[a-zA-Z0-9_-]+$/.test(name)&&saveFile&&out&&!fs.existsSync(out));
const root=`dist/${name}/tidelands-local`,origin='http://127.0.0.1:4190',key='tidelands-save-v1';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(`dist/${name}.zip`),manifest.archiveSha256);
for(const [file,entry] of Object.entries(manifest.files))assert.equal(sha(`${root}/${file}`),entry.sha256,file);
const report={archive:manifest.archiveSha256,save:sha(saveFile),rows:[],logs:[],complete:false};
const trace=`
const loadTrace={events:[],longFrames:[]};
window.loadTrace=loadTrace;
const note=(name,start=performance.now(),extra={})=>{
  if(loadTrace.events.length<2500)loadTrace.events.push({name,start,end:performance.now(),...extra});
};
document.addEventListener('click',e=>{if(e.target.id==='start-button')note('start');},true);
document.addEventListener('change',e=>{if(e.target.id==='import-file')note('file-change');},true);
if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')){
  new PerformanceObserver(list=>{
    for(const e of list.getEntries())loadTrace.longFrames.push({start:e.startTime,duration:e.duration,
      scripts:e.scripts.map(s=>({file:s.sourceURL?.split('/').at(-1),name:s.sourceFunctionName,ms:s.duration}))});
  }).observe({type:'long-animation-frame'});
}
const observed=new WeakSet();
for(const name of ['sync','draw','warmInlandTree']){
  const method=WorldView.prototype[name];
  WorldView.prototype[name]=function(...args){
    if(!observed.has(this)){
      observed.add(this);
      const renderer=this.renderer,render=renderer.render,gl=renderer.getContext();
      let calls=null;
      for(const op of ['linkProgram','getProgramParameter','getShaderParameter','getActiveUniform','bufferData',
        'texStorage2D','texImage2D','texSubImage2D','drawElements','drawElementsInstanced','drawArrays','blitFramebuffer']){
        const native=gl[op];
        gl[op]=function(...params){
          if(!calls)return native.apply(this,params);
          const start=performance.now();
          try{return native.apply(this,params);}finally{
            const item=calls[op]??={count:0,ms:0,max:0},ms=performance.now()-start;
            item.count++;item.ms+=ms;item.max=Math.max(item.max,ms);
          }
        };
      }
      renderer.render=function(...pargs){
        const start=performance.now();
        calls={};
        try{return render.apply(this,pargs);}finally{
          note('render',start,{triangles:this.info.render.triangles,gl:calls});calls=null;
        }
      };
    }
    const start=performance.now();
    try{return method.apply(this,args);}
    finally{note(name,start,{time:args[0]?.time,panel:document.querySelector('#panel').open});}
  };
}
`;
fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
  for(const width of [1920,390]){
    const context=await browser.newContext({viewport:{width,height:width===390?844:1080},deviceScaleFactor:width===390?1.5:1});
    try{
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin)return route.abort();
        if(url.pathname===`/${root}/src/scene.js`)return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(`${root}/src/scene.js`,'utf8')+trace});
        return route.continue();
      });
      const page=await context.newPage();
      page.on('pageerror',e=>report.logs.push(e.message));
      page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
      const ready=()=>page.waitForFunction(()=>!document.querySelector('#start-button').disabled,undefined,{timeout:90000});
      await page.goto(`${origin}/${root}/`);await ready();
      await page.click('#start-button');await page.click('#pause-button');
      const file=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await file).setFiles(saveFile);
      await page.waitForFunction(()=>!document.querySelector('#panel').open);
      await page.waitForTimeout(650);
      const imported=await page.evaluate(()=>window.loadTrace);
      await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();
      const saved=await page.evaluate(key=>localStorage.getItem(key),key);
      await page.reload();await ready();
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
      const startLabel=await page.locator('#start-button').textContent(),loadStatus=await page.locator('#load-status').textContent();
      await page.click('#start-button');await page.waitForTimeout(650);
      const continued=await page.evaluate(()=>window.loadTrace);
      await page.click('#pause-button');
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'导出存档',exact:true}).click();
      const exported=path.join(out,`${width}-restore.json`);await(await download).saveAs(exported);
      // The naturally advancing continue observation changes the clock. Verify the exact
      // persisted state before live continuation and the actual continued export separately.
      const final=JSON.parse(fs.readFileSync(exported)),prior=JSON.parse(saved);
      assert.match(startLabel,/继续旅程/);assert.match(loadStatus,/群岛已就绪/);
      assert.deepEqual(final.buildings,prior.buildings);assert.deepEqual(final.inventory,prior.inventory);
      assert.equal(final.quest,prior.quest);assert(final.time>=prior.time);
      const glError=await page.evaluate(()=>document.querySelector('#world').getContext('webgl2').getError());
      assert.equal(glError,0);
      report.rows.push({width,glError,imported,continued});
    }finally{await context.close();}
  }
  assert.deepEqual(report.logs,[]);assert.equal(sha(saveFile),report.save);report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{try{await browser.close();}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
