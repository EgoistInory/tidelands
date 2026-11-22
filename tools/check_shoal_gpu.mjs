// Replay observed Amber Shoal viewpoints in the extracted package, with one GPU query per frame.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const [name, routeDir, out, mode, baselineName] = process.argv.slice(2);
const shadowCheck = mode === '--shadow-check';
const fullCheck = mode === '--full-check';
assert(/^[a-zA-Z0-9_-]+$/.test(name) && routeDir && out && !fs.existsSync(out));
assert(mode===undefined||shadowCheck||fullCheck);
assert(baselineName===undefined||(fullCheck&&/^[a-zA-Z0-9_-]+$/.test(baselineName)));
const root = `dist/${name}/tidelands-local`;
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(`dist/${name}.zip`), manifest.archiveSha256);
for (const [file, entry] of Object.entries(manifest.files)) assert.equal(sha(`${root}/${file}`), entry.sha256, file);
const raw = JSON.parse(fs.readFileSync(path.join(routeDir,'raw.json')));
assert(raw.complete && raw.width===1920);
if (baselineName) {
  const baseline = JSON.parse(fs.readFileSync(`dist/${baselineName}.json`));
  assert.equal(sha(`dist/${baselineName}.zip`),raw.packageSha256);
  assert.equal(baseline.archiveSha256,raw.packageSha256);
  assert.deepEqual(Object.keys(manifest.files),Object.keys(baseline.files));
  assert.deepEqual(Object.keys(manifest.files).filter(file=>manifest.files[file].sha256!==baseline.files[file].sha256),['src/scene.js']);
} else {
  assert.equal(raw.packageSha256,manifest.archiveSha256);
}
const [landing,dune] = ['07-shoal-landing','08-shoal-dune'].map(label=>raw.phases.find(p=>p.name===label));
const frameFile = path.join(routeDir,'frames.jsonl');
const batches = fs.readFileSync(frameFile,'utf8').trim().split('\n').map(JSON.parse);
const frames = new Map(batches.flatMap(batch=>batch.frames).map(frame=>[frame[0],frame]));
const samples = batches.flatMap(batch=>batch.gpu).filter(s=>s.time>landing.time && s.time<=dune.time);
const slowLand = samples.find(s=>s.ms>20);
const slowDune = samples.reduce((max,s)=>s.ms>max.ms?s:max);
const fastDune = samples.find(s=>s.time>slowDune.time && s.ms<17);
const cases = [['landing',slowLand,landing],['dune',slowDune,dune],['dune-control',fastDune,dune]].map(([site,sample,checkpoint])=>{
  assert(sample, site);
  const f = frames.get(sample.frame), save = path.join(routeDir,checkpoint.save);
  assert.equal(sha(save),checkpoint.saveSha256);
  return {site, sample, save:fs.readFileSync(save,'utf8'), saveSha256:checkpoint.saveSha256,
    position:[f[3],f[4]], camera:f.slice(13,16), cameraInput:f.slice(17,20)};
});
if(fullCheck)cases.push({...cases[1],site:'dune-day',overrideTime:240});

const fixture = 'tests/regional-landform-review.html';
const html = fs.readFileSync(fixture,'utf8')
  .replace('</style>','nav,output{display:none}</style>')
  .replace('freshGame,movePlayer','freshGame,restore,movePlayer')
  .replace('window.regionalReview={reset,snapshot,move,sites};',`
window.shoalTiming = {
  view,
  load({save,position,camera:eye,cameraInput:[yaw,pitch,distance],sample,overrideTime}){
    state=restore(save);
    [state.player.x,state.player.z]=position;
    state.time=overrideTime??sample.time;
    view.player.userData.lastPosition=null;
    view.player.userData.worldFeet=null;
    view.camera.position.fromArray(eye);
    Object.assign(view,{yaw,pitch,distance});
    view.sync(state);
    view.draw(state,nearest(state,world.objects),null,false,0);
    view.camera.position.fromArray(eye);
    view.camera.lookAt(state.player.x,Math.max(terrain(...position),-.45)+2.4,state.player.z);
    view.sky.position.copy(view.camera.position);
    view.coastal.update(state);
    view.inland.update(state);
    updateGroundCover(view.meadow,view.camera.position);
    view.finish.render(view.scene,view.camera);
  },
  draw(){view.finish.render(view.scene,view.camera);}
};
`);
assert(html.includes('window.shoalTiming'));
const {chromium} = await import(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const origin = 'http://127.0.0.1:4190', entry = `/${root}/${fixture}`;
const report = {complete:false,archiveSha256:manifest.archiveSha256,frameStreamSha256:sha(frameFile),
  fixtureSha256:sha(fixture),runnerSha256:sha(new URL(import.meta.url)), variant:mode??'pass-timing', rows:[], logs:[],
  scope:'Static scenes using recorded route position, camera and clock with the nearest checkpoint save. One query around each selected renderer.render or the full HDR draw. Pass queries exclude the surrounding target changes and cannot be added to infer frame time.'};
fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try {
  const context = await browser.newContext({viewport:{width:1920,height:1080}});
  await context.route('**/*', route=>{
    const url = new URL(route.request().url());
    if (url.origin!==origin) return route.abort();
    if (url.pathname===entry) return route.fulfill({body:html,contentType:'text/html'});
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror',error=>report.logs.push(error.message));
  page.on('console',event=>{if(['warning','error'].includes(event.type()))report.logs.push(event.text());});
  await page.goto(origin+entry);
  await page.waitForFunction(()=>window.shoalTiming,undefined,{timeout:90000});
  for (const fixtureCase of cases) {
    const timing = await page.evaluate(async({fixtureCase,shadowCheck,fullCheck})=>{
      const {view,load,draw} = window.shoalTiming;
      const renderer = view.renderer, gl = renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) throw Error('Native GPU timing unavailable');
      load(fixtureCase);
      for (let i=0;i<18;i++){draw();await new Promise(requestAnimationFrame);}
      const passes = fullCheck?['full']:shadowCheck?['full','reuse-shadow']:['world','highlights','blur','composite','full'];
      const values = Object.fromEntries(passes.map(pass=>[pass,[]]));
      const counters = [], original = renderer.render;
      let selected, index, query, wholeFrame;
      renderer.render = function(...args) {
        const pass = index++, timed = !wholeFrame&&pass===selected;
        if (timed) gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
        try {return original.apply(this,args);}
        finally {
          if (timed) gl.endQuery(ext.TIME_ELAPSED_EXT);
          if (counters.length<4) counters.push({calls:this.info.render.calls,triangles:this.info.render.triangles});
        }
      };
      try {
        for (let i=0;i<24;i++) for (let slot=0;slot<passes.length;slot++) {
          selected=(i+slot)%passes.length;
          wholeFrame=fullCheck||shadowCheck||selected===4;
          if(shadowCheck)renderer.shadowMap.autoUpdate=selected===0;
          index=0;
          query=gl.createQuery();
          try {
            if (wholeFrame) gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
            try {draw();} finally {if(wholeFrame)gl.endQuery(ext.TIME_ELAPSED_EXT);}
            if(index!==4)throw Error(`Expected four passes, observed ${index}`);
            let available=false;
            for(let attempt=0;attempt<120;attempt++){
              await new Promise(requestAnimationFrame);
              if (gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){available=true;break;}
            }
            if(!available||gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('Native GPU query invalid');
            const ms=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;
            if(!Number.isFinite(ms)||ms<=0)throw Error('Invalid GPU duration');
            values[passes[selected]].push(ms);
          } finally {gl.deleteQuery(query);}
        }
      } finally {
        renderer.render=original;
        if(shadowCheck)renderer.shadowMap.autoUpdate=true;
      }
      const metrics=Object.fromEntries(Object.entries(values).map(([key,values])=>{
        const sorted=[...values].sort((a,b)=>a-b);
        return [key,{median:sorted[11],p95:sorted[22],max:sorted[23],samples:values}];
      }));
      let shadowTargetWrites=0;
      const setTarget=renderer.setRenderTarget;
      renderer.setRenderTarget=function(target,...rest) {
        if(target&&target===view.sun.shadow.map)shadowTargetWrites++;
        return setTarget.call(this,target,...rest);
      };
      try {draw();} finally {renderer.setRenderTarget=setTarget;}
      return {buffer:[view.canvas.width,view.canvas.height],metrics,counters,glError:gl.getError(),
        camera:view.camera.position.toArray(),storage:localStorage.length,shadowTargetWrites,
        sun:{intensity:view.sun.intensity,shadowAutoUpdate:view.sun.shadow.autoUpdate},waterSun:view.waterUniforms.sunlight.value};
    },{fixtureCase,shadowCheck,fullCheck});
    assert.deepEqual(timing.buffer,[1920,1080]);assert.deepEqual(timing.camera,fixtureCase.camera);
    assert.equal(timing.glError,0);assert.equal(timing.storage,0);
    assert.equal(timing.shadowTargetWrites>0,timing.sun.shadowAutoUpdate);
    const {site,save:_,...observed} = fixtureCase;
    const image = path.join(out,site+'.jpg');
    await page.locator('canvas').screenshot({path:image,type:'jpeg',quality:87});
    report.rows.push({site,...observed,...timing,screenSha256:sha(image)});
    console.log(JSON.stringify({site,passP95:Object.fromEntries(Object.entries(timing.metrics).map(([key,row])=>[key,row.p95]))}));
  }
  assert.deepEqual(report.logs,[]);
  report.complete=true;
} catch(error) {report.error=error.stack;process.exitCode=1;console.error(error);}
finally {try {await browser.close();} finally {fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
