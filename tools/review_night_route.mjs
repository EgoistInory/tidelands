// Compare complete HDR frames at the same world, time and camera.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {guardCameraQaRoute} from './camera_policy_qa.mjs';

const output=process.argv[2],baseline='ff577203f83a022e2b8aa664d22ac8b934c95811';
assert(output&&!fs.existsSync(output));fs.mkdirSync(output,{recursive:true});
const files=['src/scene.js','src/scene-finish.js'],origin='http://127.0.0.1:4190';
const old=new Map(files.map(file=>['/'+file,execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'})]));
const sha=data=>createHash('sha256').update(data).digest('hex');
const report={complete:false,baseline,source:Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(file))])),rows:[],logs:[],scope:'Lit game assets and production HDR with declared camera/time fixtures. No save interaction.'};
const html=fs.readFileSync('tests/regional-landform-review.html','utf8')
  .replace('coast:[-130,20],forest:[164.4377,-108.4654],highland:[-41.4534111,-208.3750763]', 'coast:[-68,102],forest:[112,-23],highland:[-59,96]')
  .replace('state.time=240;', 'state.time=Number(document.body.dataset.time||240);state.buildings=[{id:"night-camp",type:"campfire",x:-73.063,z:106.723}];')
  .replace('window.regionalReview={reset,snapshot,move,sites};','window.regionalReview={reset,snapshot,view};');
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try {
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
      for(const [site,time,label] of [['forest',1997,'forest'],['highland',1905,'approach'],['coast',1905,'fire'],['coast',240,'day']]){
        const row=await page.evaluate(({site,time})=>{
          const {view,reset}=window.regionalReview,renderer=view.renderer,render=renderer.render,passes=[];
          document.body.dataset.time=time;
          renderer.render=function(...args){render.apply(this,args);passes.push({...this.info.render});};
          try{
            return {...reset(site,'near'),hdr:!!view.finish,passes:passes.slice(-4),fire:{range:view.fireLight.distance,intensity:view.fireLight.intensity}};
          } finally {renderer.render=render;}
        },{site,time});
        assert(row.worldUnchanged&&row.stateUnchanged&&row.glError===0&&row.hdr&&row.passes.length===4&&row.passes[0].calls>1);
        assert(Object.values(row.authored).every(Boolean));
        const image=`${width}-${label}-${variant}.png`;
        await page.screenshot({path:path.join(output,image)});
        report.rows.push({width,variant,label,image,sha256:sha(fs.readFileSync(path.join(output,image))),...row});
      }
      assert.equal(await page.evaluate(()=>localStorage.length),0);
    }finally{await context.close();}
  }
  for(const a of report.rows.filter(row=>row.variant==='after')){
    const b=report.rows.find(row=>row.width===a.width&&row.label===a.label&&row.variant==='before');
    for(const key of ['camera','lookAt','passes','buffer','time'])assert.deepEqual(a[key],b[key],key);
  }
  assert.deepEqual(report.logs,[]);report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{try{await browser.close();}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}}
