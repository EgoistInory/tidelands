// Native file import and keyboard traversal on the untouched extracted release.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {HIGHLAND_ASCENT,highlandAscent} from '../src/highland-ascent.js';
import {terrain} from '../src/world.js';
import {world,nextInput} from './journey_path.mjs';
import {bindCampaignContacts} from './campaign_contact_plan.mjs';
import {assertCameraRestoreEvidence} from './camera_policy_qa.mjs';

const [name,out]=process.argv.slice(2);
assert(/^[a-zA-Z0-9_-]+$/.test(name)&&out&&!fs.existsSync(out));
const root=`dist/${name}/tidelands-local`,key='tidelands-save-v1',origin='http://127.0.0.1:4190';
const history='docs/movement-native-2026-11-05/01-highland-arrival-save.json';
const original=fs.readFileSync(history),seed=JSON.parse(original),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(fs.readFileSync(`dist/${name}.zip`)),manifest.archiveSha256);
for(const [file,{sha256}] of Object.entries(manifest.files)){
  assert.equal(sha(fs.readFileSync(`${root}/${file}`)),sha256,file);
  assert.equal(sha(fs.readFileSync(file==='README.md'?'docs/LOCAL-DELIVERY.md':file)),sha256,file);
}
const report={complete:false,archiveSha256:manifest.archiveSha256,saveSha256:sha(original),rows:[],logs:[],scope:'Original extracted game, historical normal save, held keys down to the shore and back uphill. No renderer or state interception.'};
const contacts=bindCampaignContacts(world);
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
fs.mkdirSync(out,{recursive:true});
try{
  for(const width of [1280,390]){
    const dir=path.join(out,String(width));fs.mkdirSync(dir);
    const context=await browser.newContext({viewport:{width,height:width===390?844:800},recordVideo:{dir,size:{width:960,height:600}}});
    const page=await context.newPage(),inputs=[],phases=[];
    const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const observe=async()=>{await page.keyboard.press('1');return read();};
    const capture=async label=>{
      const s=await observe(),{player,time}=s,image=label+'.jpg',height=terrain(player.x,player.z);
      await page.screenshot({path:path.join(dir,image),type:'jpeg',quality:87});
      phases.push({label,player,time,height,wear:highlandAscent(player.x,player.z,height)?.wear??0,image,sha256:sha(fs.readFileSync(path.join(dir,image)))});
      return s;
    };
    const go=async(i,talk=false)=>{
      const [x,z]=HIGHLAND_ASCENT[i],target={id:`ascent-${i}`,x,z,type:'waypoint'};
      for(let n=0;n<55;n++){
        const s=await observe(),dx=x-s.player.x,dz=z-s.player.z;
        if(talk&&Math.hypot(dx,dz)<4&&(await page.locator('#interact-label').textContent()).includes('远舟'))return;
        const route=nextInput({...s,requestedYaw:.15},target);
        if(route.reached&&!talk)return;
        const cx=dx*Math.cos(.15)-dz*Math.sin(.15),cz=dx*Math.sin(.15)+dz*Math.cos(.15);
        const key=route.reached?(Math.abs(cx)>Math.abs(cz)?(cx>0?'d':'a'):(cz>0?'s':'w')):route.key;
        assert(key,`No route to ${target.id}`);
        const ms=route.reached?100:route.durationMs;
        inputs.push({target:target.id,key,ms,x:s.player.x,z:s.player.z});
        await page.keyboard.down(key);
        try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}
      }
      throw Error(`Navigation budget exceeded for ${target.id}`);
    };
    page.setDefaultTimeout(90000);
    page.on('pageerror',e=>report.logs.push(e.message));
    page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
    try{
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      await page.goto(`${origin}/${root}/`);
      await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
      await page.click('#start-button');await page.click('#pause-button');
      const file=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await file).setFiles(history);
      await page.waitForFunction(()=>!document.querySelector('#panel').open);
      const initial=await capture('00-import');
      assert(Math.hypot(initial.player.x-seed.player.x,initial.player.z-seed.player.z)<.01);
      for(const i of [5,4,3,2,1,0])await go(i);
      await capture('01-foot');
      for(const i of [1,2,3])await go(i);
      await capture('02-ascent');
      for(const i of [4,5])await go(i);
      await go(6,true);await page.keyboard.press('e');await page.waitForTimeout(230);
      assert.match(await page.locator('#toast').textContent(),/^远舟：/);
      const final=await capture('03-lookout');
      assert(phases[3].height-phases[1].height>19 && phases[2].height>phases[1].height+8);
      assert.equal(final.quest,seed.quest);assert.equal(final.kills,seed.kills);assert(final.player.hp>0);
      assert.deepEqual(final.buildings,seed.buildings);assert.deepEqual(final.inventory,seed.inventory);
      await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();
      const saved=await page.evaluate(k=>localStorage.getItem(k),key);
      await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
      const startLabel=await page.locator('#start-button').textContent(),loadStatus=await page.locator('#load-status').textContent();
      await page.evaluate(()=>{document.querySelector('#start-button').click();document.querySelector('#pause-button').click();});
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'导出存档',exact:true}).click();
      const exported=path.join(dir,'restored-live-export.json');await(await download).saveAs(exported);
      assertCameraRestoreEvidence({startLabel,loadStatus,exported:fs.readFileSync(exported,'utf8')},saved);
      const glError=await page.evaluate(()=>document.querySelector('#world').getContext('webgl2').getError());
      assert.equal(glError,0);report.rows.push({width,phases,restore:true,glError,savedSha256:sha(saved)});
    }finally{
      fs.writeFileSync(path.join(dir,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
      await context.close();
    }
  }
  assert.deepEqual(report.logs,[]);assert.equal(sha(fs.readFileSync(history)),report.saveSha256);
  report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{contacts.release();try{await browser.close();}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
