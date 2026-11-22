// Observe the native file import and continue buttons on a verified extracted build.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const [name,saveFile,out,mode]=process.argv.slice(2);
assert(/^[a-zA-Z0-9_-]+$/.test(name)&&saveFile&&out&&!fs.existsSync(out));
assert(mode===undefined||mode==='--profile');
const root=`dist/${name}/tidelands-local`,origin='http://127.0.0.1:4190',key='tidelands-save-v1';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(`dist/${name}.zip`),manifest.archiveSha256);
for(const [file,entry] of Object.entries(manifest.files))assert.equal(sha(`${root}/${file}`),entry.sha256,file);
const report={archive:manifest.archiveSha256,save:sha(saveFile),rows:[],logs:[],complete:false};
const trace=String.raw`
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
      const shaders=new WeakMap(),programShaders=new WeakMap();
      const shaderSource=gl.shaderSource,attachShader=gl.attachShader;
      gl.shaderSource=function(shader,source){
        const material=source.match(/^#define SHADER_NAME (.+)$/m)?.[1]?.trim()||null;
        const type=source.match(/^#define SHADER_TYPE (.+)$/m)?.[1]?.trim()||null;
        const variants=source.match(/^#define (?:USE_INSTANCING|USE_SHADOWMAP|NUM_DIR_LIGHT_SHADOWS)\b.*$/gm)??[];
        shaders.set(shader,{material,type,variants});
        return shaderSource.call(this,shader,source);
      };
      gl.attachShader=function(program,shader){
        const attached=programShaders.get(program)??[];
        attached.push(shaders.get(shader));
        programShaders.set(program,attached);
        return attachShader.call(this,program,shader);
      };
      let calls=null,programLogs=null;
      for(const op of ['compileShader','linkProgram','useProgram','getProgramParameter','getShaderParameter',
        'getProgramInfoLog','getShaderInfoLog','getActiveUniform','getUniformLocation','getActiveAttrib','getAttribLocation',
        'bufferData','bufferSubData','texStorage2D','texImage2D','texSubImage2D','texParameteri','generateMipmap','checkFramebufferStatus',
        'drawElements','drawElementsInstanced','drawArrays','blitFramebuffer']){
        const native=gl[op];
        gl[op]=function(...params){
          if(!calls)return native.apply(this,params);
          const start=performance.now();
          try{return native.apply(this,params);}finally{
            const item=calls[op]??={count:0,ms:0,max:0},ms=performance.now()-start;
            item.count++;item.ms+=ms;item.max=Math.max(item.max,ms);
            if(op==='getProgramInfoLog')programLogs.push({shaders:programShaders.get(params[0]),ms});
          }
        };
      }
      renderer.render=function(...pargs){
        const start=performance.now();
        calls={};
        programLogs=[];
        try{return render.apply(this,pargs);}finally{
          note('render',start,{triangles:this.info.render.triangles,gl:calls,programLogs});calls=null;programLogs=null;
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
      await page.getByRole('button',{name:'导入存档',exact:true}).click();
      const chooser=await file;
      const cdp=mode==='--profile'?await context.newCDPSession(page):null;
      let navigationStart;
      if(cdp){
        await cdp.send('Performance.enable');
        const {metrics}=await cdp.send('Performance.getMetrics');
        navigationStart=metrics.find(metric=>metric.name==='NavigationStart')?.value;
        assert(navigationStart>0);
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval',{interval:1000});
        await cdp.send('Profiler.start');
      }
      await chooser.setFiles(saveFile);
      const firstDraw=await page.waitForFunction(()=>{
        const events=window.loadTrace.events;
        const fileChange=events.find(event=>event.name==='file-change');
        return fileChange&&events.find(event=>event.name==='draw'&&event.start>=fileChange.end&&!event.panel);
      });
      const importDraw=await firstDraw.jsonValue();
      if(cdp){
        const {profile}=await cdp.send('Profiler.stop');
        assert((profile.startTime/1e3-navigationStart*1e3)<=importDraw.start);
        assert((profile.endTime/1e3-navigationStart*1e3)>=importDraw.end);
        fs.writeFileSync(path.join(out,`${width}-import-profile.json`),JSON.stringify({navigationStart,importDraw,profile}));
        await cdp.detach();
      }
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
      const {glError,parallelShaderCompile}=await page.evaluate(()=>{
        const gl=document.querySelector('#world').getContext('webgl2');
        return {glError:gl.getError(),parallelShaderCompile:Boolean(gl.getExtension('KHR_parallel_shader_compile'))};
      });
      assert.equal(glError,0);
      report.rows.push({width,glError,parallelShaderCompile,importDraw,imported,continued});
    }finally{await context.close();}
  }
  assert.deepEqual(report.logs,[]);assert.equal(sha(saveFile),report.save);report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{try{await browser.close();}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
