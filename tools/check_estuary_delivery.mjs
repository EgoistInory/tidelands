// Native file input and the normal browser controls on the extracted build.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {world, nextInput} from './journey_path.mjs';
import {bindCampaignContacts} from './campaign_contact_plan.mjs';
import {LANDMARKS, terrain} from '../src/world.js';
import {assertCameraRestoreEvidence} from './camera_policy_qa.mjs';

const [name, output, saveFile, route] = process.argv.slice(2);
const interior = route === '--shoal-interior';
const shoal = route === '--shoal' || interior;
assert(route===undefined || shoal);
assert(/^[a-zA-Z0-9_-]+$/.test(name));
assert(output && !fs.existsSync(output));
const sha = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(fs.readFileSync(`dist/${name}.zip`)), manifest.archiveSha256);
const packageRoot = `dist/${name}/tidelands-local`;
for (const [file, {sha256}] of Object.entries(manifest.files)) {
  assert.equal(sha(fs.readFileSync(`${packageRoot}/${file}`)), sha256, file);
  assert.equal(sha(fs.readFileSync(file === 'README.md' ? 'docs/LOCAL-DELIVERY.md' : file)), sha256, file);
}
const seed = JSON.parse(fs.readFileSync(saveFile));
const saveDigest = sha(fs.readFileSync(saveFile));
const key = 'tidelands-save-v1';
const origin = 'http://127.0.0.1:4190';
const report = {complete:false, logs:[], rows:[], archiveSha256:manifest.archiveSha256, saveDigest, scope:'Original extracted index and modules, real imported journey save, held keyboard inputs and ordinary menu exports. No position, game clock or enemy injection.'};
fs.mkdirSync(output, {recursive:true});
const {chromium} = await import(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const browser = await chromium.launch({headless:true,channel:'chromium',args:['--use-angle=metal']});
const contacts = bindCampaignContacts(world);
try {
  for (const width of [1280,390]) {
    const dir = path.join(output,String(width));
    fs.mkdirSync(dir);
    const context = await browser.newContext({viewport:{width,height:width===390?844:800},recordVideo:{dir,size:{width:960,height:600}}});
    const page = await context.newPage();
    const video = page.video();
    const journal = [];
    const phases = [];
    const read = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)),key);
    const observe = async () => {await page.keyboard.press('1');return read();};
    const capture = async label => {
      const s=await observe(), image=`${label}.jpg`;
      await page.screenshot({path:path.join(dir,image),type:'jpeg',quality:87});
      phases.push({label,player:s.player,time:s.time,terrain:terrain(s.player.x,s.player.z),image,sha256:sha(fs.readFileSync(path.join(dir,image)))});
      return s;
    };
    const go = async target => {
      for (let i=0;i<60;i++) {
        const state=await observe();
        const step=nextInput({...state,requestedYaw:.15},target);
        if (step.reached) return;
        assert(step.key,`No route to ${target.id}`);
        journal.push({target:target.id,key:step.key,ms:step.durationMs,x:state.player.x,z:state.player.z,hp:state.player.hp});
        await page.keyboard.down(step.key);
        try {await page.waitForTimeout(step.durationMs);} finally {await page.keyboard.up(step.key);}
      }
      throw Error(`Navigation budget exceeded for ${target.id}`);
    };
    page.setDefaultTimeout(90000);
    page.on('pageerror', e => report.logs.push(e.message));
    page.on('console', e => {if (['warning','error'].includes(e.type())) report.logs.push(e.text());});
    try {
      await context.route('**/*',route => new URL(route.request().url()).origin===origin ? route.continue() : route.abort());
      await page.goto(`${origin}/${packageRoot}/`);
      await page.waitForFunction(() => !document.querySelector('#start-button').disabled);
      await page.click('#start-button');
      await page.click('#pause-button');
      const file = page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();
      await (await file).setFiles(saveFile);
      await page.waitForFunction(() => !document.querySelector('#panel').open);
      const initial = await capture('00-imported');
      assert(Math.hypot(initial.player.x-seed.player.x,initial.player.z-seed.player.z)<.01);
      let high,dialogue;
      if(shoal){
        await go({id:'shoal-crossing',type:'waypoint',x:44,z:100});
        const water=await capture('01-water');
        assert(terrain(water.player.x,water.player.z)<-1.8);
        await go({id:'shoal-landing',type:'waypoint',x:86,z:139});
        const landing=await capture('02-landing');
        assert(terrain(landing.player.x,landing.player.z)>0);
        const shell=world.objects.find(o=>o.id==='resource-1077');
        await go(shell);
        assert.match(await page.locator('#interact-label').textContent(),/拾取贝壳/);
        await page.keyboard.press('e');
        await page.waitForTimeout(520);
        const gathered=await capture('03-shell');
        assert.equal(gathered.inventory.shell,seed.inventory.shell+2);
        await go({id:'shoal-ridge',type:'waypoint',x:110,z:159});
        high=await capture('04-ridge');
        assert(terrain(high.player.x,high.player.z)>terrain(landing.player.x,landing.player.z)+2);
        assert.deepEqual(high.inventory,{...seed.inventory,shell:seed.inventory.shell+2});
        if(interior){
          await go({id:'shoal-inner-rise',type:'waypoint',x:123,z:175});
          const vantage=await capture('05-inner-rise');
          assert(terrain(vantage.player.x,vantage.player.z)>terrain(high.player.x,high.player.z)+3);
          const {x,y,width,height}=await page.locator('#world').boundingBox();
          const start=x+width*.23,lookY=y+height*.56;
          assert(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id==='world',[start,lookY]));
          for(let i=0;i<3;i++){
            await page.mouse.move(start,lookY);
            await page.mouse.down();
            await page.mouse.move(start+126,lookY,{steps:21});
            await page.mouse.up();
          }
          await page.waitForTimeout(550);
          high=await capture('06-inland-look');
          assert(Math.hypot(high.player.x-vantage.player.x,high.player.z-vantage.player.z)<.01);
          assert.deepEqual(high.inventory,{...seed.inventory,shell:seed.inventory.shell+2});
        }
      }else{
        await go({id:'estuary-landing',type:'npc',x:76,z:-19});
        const low=await capture('01-landing');
        await go(LANDMARKS.find(o=>o.id==='botanist'));
        await page.keyboard.press('e');
        await page.waitForTimeout(250);
        dialogue=await page.locator('#toast').textContent();
        high=await capture('02-forest');
        assert(terrain(high.player.x,high.player.z)-terrain(low.player.x,low.player.z)>9);
        assert.match(dialogue,/^林栖：/);
        assert.deepEqual(high.inventory,seed.inventory);
      }
      assert(high.player.hp>0);
      assert.equal(high.quest,seed.quest);
      assert.equal(high.kills,seed.kills);
      assert.deepEqual(high.buildings,seed.buildings);
      await page.click('#pause-button');
      await page.getByRole('button',{name:'保存进度',exact:true}).click();
      const saved=await page.evaluate(k => localStorage.getItem(k),key);
      fs.writeFileSync(path.join(dir,'final-save.json'),saved);
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('#start-button').disabled);
      const startLabel=await page.locator('#start-button').textContent(),loadStatus=await page.locator('#load-status').textContent();
      await page.evaluate(() => {document.querySelector('#start-button').click();document.querySelector('#pause-button').click();});
      assert(await page.locator('#panel').evaluate(element=>element.open));
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'导出存档',exact:true}).click();
      const exportPath=path.join(dir,'restored-live-export.json');
      await (await download).saveAs(exportPath);
      assertCameraRestoreEvidence({startLabel,loadStatus,exported:fs.readFileSync(exportPath,'utf8')},saved);
      const glError=await page.evaluate(() => document.querySelector('#world').getContext('webgl2').getError());
      assert.equal(glError,0);
      await context.close();
      report.rows.push({width,phases,dialogue,glError,restore:true,video:path.basename(await video.path()),savedSha256:sha(saved)});
    } finally {
      fs.writeFileSync(path.join(dir,'inputs.json'),JSON.stringify(journal,null,2)+'\n');
      await context.close();
    }
  }
  assert.deepEqual(report.logs,[]);
  assert.equal(sha(fs.readFileSync(saveFile)),saveDigest);
  report.complete=true;
} catch(error) {report.error=error.stack;process.exitCode=1;console.error(error);}
finally {contacts.release();try {await browser.close();} finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}}
