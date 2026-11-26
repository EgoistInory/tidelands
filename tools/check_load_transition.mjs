// Observe the native file import and continue buttons on a verified extracted build.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const [name,saveFile,out,mode]=process.argv.slice(2);
assert(/^[a-zA-Z0-9_-]+$/.test(name)&&saveFile&&out&&!fs.existsSync(out));
assert(mode===undefined||mode==='--profile'||mode==='--no-parallel-compile'||mode==='--walk-yard'||mode==='--touch'||mode==='--mix-yard');
const root=`dist/${name}/tidelands-local`,origin='http://127.0.0.1:4190',key='tidelands-save-v1';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(`dist/${name}.zip`),manifest.archiveSha256);
for(const [file,entry] of Object.entries(manifest.files))assert.equal(sha(`${root}/${file}`),entry.sha256,file);
const report={archive:manifest.archiveSha256,save:sha(saveFile),rows:[],logs:[],complete:false};
const mixObserver=mode==='--mix-yard'?fs.readFileSync(new URL('./observe_main_mix.js',import.meta.url),'utf8'):null;
const trace=String.raw`
const loadTrace={events:[],longFrames:[],longTasks:[]};
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
if(PerformanceObserver.supportedEntryTypes.includes('longtask')){
  new PerformanceObserver(list=>{
    for(const e of list.getEntries())loadTrace.longTasks.push({start:e.startTime,duration:e.duration});
  }).observe({type:'longtask'});
}
const observed=new WeakSet();
for(const name of ['sync','draw','warmInlandTree']){
  const method=WorldView.prototype[name];
  WorldView.prototype[name]=function(...args){
    if(!observed.has(this)){
      observed.add(this);
      const renderer=this.renderer,render=renderer.render,compile=renderer.compile,gl=renderer.getContext();
      renderer.compile=function(...params){
        const start=performance.now(),before=this.info.programs.length;
        try{return compile.apply(this,params);}finally{note('compile',start,{programs:this.info.programs.length-before});}
      };
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
    finally{note(name,start,{time:args[0]?.time,panel:document.querySelector('#panel').open,yaw:this.yaw});}
  };
}
`;
fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chromium',headless:true,args:['--use-angle=metal']});
try{
  const widths=mode==='--touch'?[390]:mode==='--mix-yard'?[1920]:[1920,390];
  for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:width===390?844:1080},deviceScaleFactor:width===390?1.5:1,hasTouch:mode==='--touch'});
    try{
      const mixFile=path.join(out,`${width}-main-mix.webm`);
      if(mixObserver)await context.exposeBinding('__mainMixSink',(_source,bytes)=>fs.appendFileSync(mixFile,Buffer.from(bytes)));
      if(mode==='--no-parallel-compile')await context.addInitScript(()=>{
        const original=WebGL2RenderingContext.prototype.getExtension;
        WebGL2RenderingContext.prototype.getExtension=function(name){
          if(name==='KHR_parallel_shader_compile')return null;
          return original.call(this,name);
        };
      });
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin)return route.abort();
        if(url.pathname===`/${root}/src/scene.js`)return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(`${root}/src/scene.js`,'utf8')+trace});
        if(mixObserver&&url.pathname===`/${root}/src/audio.js`)return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(`${root}/src/audio.js`,'utf8')+mixObserver});
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
      await page.screenshot({path:path.join(out,`${width}-import.jpg`),type:'jpeg',quality:85});
      let yard,touch,mix;
      if(mode==='--touch'){
        const stick=await page.locator('#joystick').boundingBox();
        const finger={id:1,x:stick.x+stick.width/2,y:stick.y+stick.height/2};
        const look={id:2,x:260,y:475};
        assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,look),'world','look contact must hit the canvas');
        await page.evaluate(()=>{
          window.gestureEvents=[];
          for(const id of ['world','joystick'])for(const type of ['pointerdown','pointermove','pointerup','pointercancel']){
            document.getElementById(id).addEventListener(type,event=>{
              window.gestureEvents.push({id,type,pointerId:event.pointerId,pointerType:event.pointerType});
            },{passive:true});
          }
        });
        const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
        const readYaw=()=>page.evaluate(()=>window.loadTrace.events.findLast(e=>e.name==='draw')?.yaw);
        const beforeYaw=await readYaw();
        const input=await context.newCDPSession(page);
        const send=(type,touchPoints)=>input.send('Input.dispatchTouchEvent',{type,touchPoints});
        const held={...finger,x:finger.x+31,y:finger.y+6};
        await send('touchStart',[finger]);
        await send('touchMove',[held]);
        await send('touchStart',[held,look]);
        try{
          for(let i=1;i<=5;i++){
            await send('touchMove',[held,{...look,x:look.x+i*10,y:look.y+i*3}]);
            await page.waitForTimeout(70);
          }
        }finally{await send('touchEnd',[]);await input.detach();}
        await page.keyboard.press('1');
        const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
        const afterYaw=await readYaw();
        assert(Math.hypot(after.player.x-before.player.x,after.player.z-before.player.z)>.75);
        assert(Math.abs(afterYaw-beforeYaw)>.15);
        const events=await page.evaluate(()=>window.gestureEvents);
        const joystick=events.find(e=>e.id==='joystick'&&e.type==='pointerdown');
        const world=events.find(e=>e.id==='world'&&e.type==='pointerdown');
        assert(joystick?.pointerType==='touch'&&world?.pointerType==='touch'&&joystick.pointerId!==world.pointerId);
        for(const contact of [joystick,world]){
          assert(events.some(e=>e.pointerId===contact.pointerId&&e.id===contact.id&&e.type==='pointermove'));
          assert(events.some(e=>e.pointerId===contact.pointerId&&e.id===contact.id&&e.type==='pointerup'));
        }
        assert(!events.some(e=>e.type==='pointercancel'));
        await page.locator('#attack-button').tap();
        await page.waitForTimeout(550);
        await page.locator('#map-button').tap();
        const map=await page.locator('#large-map').boundingBox();
        await page.touchscreen.tap(map.x+map.width*.65,map.y+map.height*.35);
        await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('已设置地图标记'));
        await page.getByRole('button',{name:'清除导航标记',exact:true}).tap();
        await page.locator('#panel-close').tap();
        touch={start:before.player,end:after.player,beforeYaw,afterYaw,events};
        await page.screenshot({path:path.join(out,'390-after-touch.jpg'),type:'jpeg',quality:85});
      }
      if(mode==='--walk-yard'||mixObserver){
        if(mixObserver){
          await page.waitForFunction(()=>window.mainMix.status().context==='running');
          await page.evaluate(()=>window.mainMix.start());
        }
        const hold=async(key,ms)=>{
          await page.keyboard.down(key);
          try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}
        };
        const snapshot=async(label)=>{
          await page.keyboard.press('1');
          const {player,buildings,inventory,quest}=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
          await page.screenshot({path:path.join(out,`${width}-${label}.jpg`),type:'jpeg',quality:85});
          return {player,buildings,inventory,quest};
        };
        const porch=await snapshot('porch');
        await hold('d',1580);
        const verge=await snapshot('verge');
        await hold('w',1320);
        const repairYard=await snapshot('repair-yard');
        await hold('s',950);await hold('a',1450);
        const returned=await snapshot('return');
        assert(verge.player.x>porch.player.x+8);
        assert(repairYard.player.z<verge.player.z-2);
        assert(repairYard.player.x>-40&&repairYard.player.z<84);
        assert(Math.hypot(returned.player.x-porch.player.x,returned.player.z-porch.player.z)<4);
        for(const state of [verge,repairYard,returned]){
          assert.deepEqual(state.buildings,porch.buildings);assert.deepEqual(state.inventory,porch.inventory);
          assert.equal(state.quest,porch.quest);
        }
        yard={porch,verge,repairYard,returned};
      }
      await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();
      if(mixObserver){
        await page.waitForTimeout(1600);
        mix=await page.evaluate(async url=>{
          const recording=await window.mainMix.stop();
          const audio=new OfflineAudioContext(2,1,48000);
          const buffer=await audio.decodeAudioData(await(await fetch(url)).arrayBuffer());
          let peak=0,clipped=0;
          for(let channel=0;channel<buffer.numberOfChannels;channel++)for(const sample of buffer.getChannelData(channel)){
            const magnitude=Math.abs(sample);peak=Math.max(peak,magnitude);if(magnitude>=1)clipped++;
          }
          return {recording,duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,peak,clipped};
        },`/${mixFile}`);
        mix.sha256=sha(mixFile);
        assert.equal(mix.channels,2);assert.equal(mix.clipped,0);
        assert(mix.duration>6&&mix.peak>.01&&mix.recording.events.some(e=>e.kind==='step'));
        assert.deepEqual(mix.recording.errors,[]);
      }
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
      const beforeInvalid=await page.evaluate(key=>localStorage.getItem(key),key);
      const invalid=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();
      await(await invalid).setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{')});
      await page.waitForFunction(()=>document.querySelector('#toast').textContent.startsWith('导入失败'));
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),beforeInvalid);
      assert.equal(await page.locator('#panel-title').textContent(),'旅途小憩');
      await page.click('#panel-close');
      assert.equal(await page.locator('#panel').evaluate(panel=>panel.open),false);
      const {glError,parallelShaderCompile}=await page.evaluate(()=>{
        const gl=document.querySelector('#world').getContext('webgl2');
        return {glError:gl.getError(),parallelShaderCompile:Boolean(gl.getExtension('KHR_parallel_shader_compile'))};
      });
      assert.equal(glError,0);
      if(mode==='--no-parallel-compile'){
        assert.equal(parallelShaderCompile,false);
        assert(!imported.events.some(event=>event.name==='compile'));
      }
      report.rows.push({width,glError,parallelShaderCompile,invalidRejected:true,importDraw,imported,continued,yard,touch,mix});
    }finally{await context.close();}
  }
  assert.deepEqual(report.logs,[]);assert.equal(sha(saveFile),report.save);report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{try{await browser.close();}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
