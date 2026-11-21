// The untouched extracted game, with a normal save recorded at dusk in the forest.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dayCycle,terrain} from '../src/world.js';
import {world,nextInput} from './journey_path.mjs';
import {bindCampaignContacts} from './campaign_contact_plan.mjs';
import {assertCameraRestoreEvidence} from './camera_policy_qa.mjs';
import {profileRoute,routeViewport,routeRequests,startRouteProfile,stopRouteProfile} from './route-frame-profile.mjs';

const [name,out]=process.argv.slice(2);
assert(/^[a-zA-Z0-9_-]+$/.test(name)&&out&&!fs.existsSync(out));
const root=`dist/${name}/tidelands-local`,key='tidelands-save-v1',origin='http://127.0.0.1:4190';
const history='docs/native-campaign-2026-11-03/05-two-kills-save.json';
const original=fs.readFileSync(history),seed=JSON.parse(original);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(fs.readFileSync(`dist/${name}.zip`)),manifest.archiveSha256);
for(const [file,{sha256}] of Object.entries(manifest.files)){
  assert.equal(sha(fs.readFileSync(`${root}/${file}`)),sha256,file);
  assert.equal(sha(fs.readFileSync(file==='README.md'?'docs/LOCAL-DELIVERY.md':file)),sha256,file);
}
const report={complete:false,archiveSha256:manifest.archiveSha256,saveSha256:sha(original),rows:[],logs:[],scope:'Original extracted index and modules. Ordinary historical save, real file input, held keys, natural time. Narrow window is not a physical device.'};
if(profileRoute)report.scope='Ordinary historical save, native inputs and clock. Only scene response appends read-only complete-draw GPU/CPU measurement. No video recording during timing.';
const camp=seed.buildings.find(b=>b.type==='campfire');
const contacts=bindCampaignContacts(world);
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
fs.mkdirSync(out,{recursive:true});
try{
  for(const width of [1280,390]){
    const dir=path.join(out,String(width));fs.mkdirSync(dir);
    const context=await browser.newContext({...routeViewport(width),...(profileRoute?{}:{recordVideo:{dir,size:{width:960,height:600}}})});
    const page=await context.newPage(),inputs=[],phases=[];
    const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const observe=async()=>{await page.keyboard.press('1');return read();};
    const capture=async(label)=>{
      const s=await observe(),{player,time}=s,image=label+'.jpg';
      await page.screenshot({path:path.join(dir,image),type:'jpeg',quality:86});
      phases.push({label,player,time,cycle:dayCycle(time),height:terrain(player.x,player.z),distanceToFire:Math.hypot(player.x-camp.x,player.z-camp.z),image,sha256:sha(fs.readFileSync(path.join(dir,image)))});
      return s;
    };
    const go=async(target,rest=false)=>{
      for(let i=0;i<145;i++){
        const s=await observe();
        if(rest && Math.hypot(s.player.x-camp.x,s.player.z-camp.z)<4 && (await page.locator('#interact-label').textContent()).includes('休息'))return;
        const route=nextInput({...s,requestedYaw:.15},target);
        if(route.reached&&!rest)return;
        const dx=target.x-s.player.x,dz=target.z-s.player.z;
        const x=dx*Math.cos(.15)-dz*Math.sin(.15),z=dx*Math.sin(.15)+dz*Math.cos(.15);
        const key=route.reached?(Math.abs(x)>Math.abs(z)?(x>0?'d':'a'):(z>0?'s':'w')):route.key;
        assert(key,`No approach to ${target.id}`);
        const ms=route.reached?100:route.durationMs;
        inputs.push({target:target.id,key,ms,x:s.player.x,z:s.player.z,time:s.time});
        await page.keyboard.down(key);
        try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}
      }
      throw Error(`Navigation budget exceeded for ${target.id}`);
    };
    page.setDefaultTimeout(90000);
    page.on('pageerror',e=>report.logs.push(e.message));
    page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
    try{
      await routeRequests(context,origin,root,dir);
      await page.goto(`${origin}/${root}/`);
      await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
      await page.click('#start-button');await page.click('#pause-button');
      const file=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();
      await(await file).setFiles(history);
      await page.waitForFunction(()=>!document.querySelector('#panel').open);
      const initial=await capture('00-forest-dusk');
      assert.equal(dayCycle(initial.time).label,'黄昏');
      assert(Math.hypot(initial.player.x-seed.player.x,initial.player.z-seed.player.z)<.01);
      await startRouteProfile(page);
      await go({id:'forest-bank',type:'waypoint',x:76,z:-19});
      await capture('01-landing');
      const shore={id:'camp-approach',type:'waypoint',x:camp.x+13,z:camp.z-10};
      await go(shore);
      for(let i=0;i<10&&dayCycle((await observe()).time).label!=='夜晚';i++)await page.waitForTimeout(2000);
      const approach=await capture('02-night-approach');
      assert.equal(dayCycle(approach.time).label,'夜晚');
      await go(camp,true);await page.keyboard.press('e');await page.waitForTimeout(250);
      assert.match(await page.locator('#toast').textContent(),/^火光/);
      const arrived=await capture('03-original-camp');
      assert.equal(dayCycle(arrived.time).label,'夜晚');
      assert.equal(arrived.quest,seed.quest);assert.equal(arrived.kills,seed.kills);
      assert.equal(arrived.player.hp,100);assert.deepEqual(arrived.buildings,seed.buildings);
      assert.deepEqual(arrived.inventory,seed.inventory);
      const timing=await stopRouteProfile(page,dir);
      await page.click('#pause-button');
      await page.getByRole('button',{name:'保存进度',exact:true}).click();
      const saved=await page.evaluate(k=>localStorage.getItem(k),key);
      await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
      const startLabel=await page.locator('#start-button').textContent(),loadStatus=await page.locator('#load-status').textContent();
      await page.evaluate(()=>{document.querySelector('#start-button').click();document.querySelector('#pause-button').click();});
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'导出存档',exact:true}).click();
      const exported=path.join(dir,'restored-live-export.json');await(await download).saveAs(exported);
      assertCameraRestoreEvidence({startLabel,loadStatus,exported:fs.readFileSync(exported,'utf8')},saved);
      const glError=await page.evaluate(()=>document.querySelector('#world').getContext('webgl2').getError());
      assert.equal(glError,0);
      report.rows.push({width,phases,rest:{before:approach.player.hp,after:arrived.player.hp},restore:true,glError,savedSha256:sha(saved),...(timing?{timing}:{})});
    }finally{
      fs.writeFileSync(path.join(dir,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
      await context.close();
    }
  }
  assert.deepEqual(report.logs,[]);assert.equal(sha(fs.readFileSync(history)),report.saveSha256);
  report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{contacts.release();try{await browser.close();}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
