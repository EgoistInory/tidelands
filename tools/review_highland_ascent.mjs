// Declared settings and matching HDR cameras on the foothill, slope and lookout.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {guardCameraQaRoute} from './camera_policy_qa.mjs';

const output=process.argv[2],baseline='5cee8c800a765b07daffd45ba5de620e7ed4e514';
assert(output&&!fs.existsSync(output));fs.mkdirSync(output,{recursive:true});
const files=['src/scene.js','src/landscape.js','src/meadow.js'],origin='http://127.0.0.1:4190';
const old=new Map(files.map(file=>['/'+file,execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'})]));
const sha=data=>createHash('sha256').update(data).digest('hex');
const report={complete:false,baseline,source:Object.fromEntries([...files,'src/highland-ascent.js'].map(file=>[file,sha(fs.readFileSync(file))])),rows:[],logs:[],scope:'Production HDR against matching fixtures. No save changes. Full-frame draw and triangle counts, no GPU timings.'};
const html=fs.readFileSync('tests/regional-landform-review.html','utf8')
  .replace('coast:[-130,20],forest:[164.4377,-108.4654],highland:[-41.4534111,-208.3750763]', 'coast:[-79,-151],forest:[-82,-166],highland:[-71,-187]')
  .replace('near:[7,6,8],middle:[25,18,28]', 'near:[6,5,12],middle:[-14,13,28]')
  .replace('h+1,z);saved','h+4,z-5);saved')
  .replace('state.time=240;', 'state.time=Number(document.body.dataset.time||240);')
  .replace('window.regionalReview={reset,snapshot,move,sites};','window.regionalReview={reset,snapshot,view};');
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
  for(const width of [1280,390])for(const variant of ['before','after']){
    const context=await browser.newContext({viewport:{width,height:width===390?844:800}});
    try{
      await context.route('**/*',guardCameraQaRoute(route=>{
        const u=new URL(route.request().url());
        if(u.origin!==origin)return route.abort();
        if(u.pathname==='/tests/regional-landform-review.html')return route.fulfill({body:html,contentType:'text/html'});
        if(variant==='before'&&old.has(u.pathname))return route.fulfill({body:old.get(u.pathname),contentType:'text/javascript'});
        return route.continue();
      },report.logs));
      const page=await context.newPage();
      page.on('pageerror',e=>report.logs.push(e.message));
      page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
      await page.goto(origin+'/tests/regional-landform-review.html');
      await page.waitForFunction(()=>!!window.regionalReview,undefined,{timeout:90000});
      for(const [site,distance,time,label] of [['coast','near',240,'entry'],['forest','middle',240,'ascent'],['highland','near',240,'lookout'],['forest','near',375,'night']]){
        const row=await page.evaluate(({site,distance,time})=>{
          const {view,reset}=window.regionalReview,renderer=view.renderer,render=renderer.render,passes=[];
          document.body.dataset.time=time;
          renderer.render=function(...args){render.apply(this,args);passes.push({...this.info.render});};
          try{return {...reset(site,distance),hdr:!!view.finish,passes:passes.slice(-4)};}
          finally{renderer.render=render;}
        },{site,distance,time});
        assert(row.worldUnchanged&&row.stateUnchanged&&row.glError===0&&row.hdr&&row.passes.length===4);
        assert(Object.values(row.authored).every(Boolean));
        const image=`${width}-${label}-${variant}.png`;
        await page.screenshot({path:path.join(output,image)});
        report.rows.push({width,variant,label,image,sha256:sha(fs.readFileSync(path.join(output,image))),...row});
      }
      assert.equal(await page.evaluate(()=>localStorage.length),0);
    }finally{await context.close();}
  }
  for(const a of report.rows.filter(r=>r.variant==='after')){
    const b=report.rows.find(r=>r.width===a.width&&r.label===a.label&&r.variant==='before');
    for(const key of ['camera','lookAt','buffer','time','position','height'])assert.deepEqual(a[key],b[key],key);
  }
  assert.deepEqual(report.logs,[]);report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{try{await browser.close();}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}}
