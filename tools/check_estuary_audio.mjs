// Original game controls with a read-only audio trace and a parallel Web Audio output.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {world, nextInput} from './journey_path.mjs';
import {bindCampaignContacts} from './campaign_contact_plan.mjs';
import {LANDMARKS, terrain, WATER_LEVEL} from '../src/world.js';
import {assertCameraRestoreEvidence} from './camera_policy_qa.mjs';

const [name, output, saveFile, route, expected] = process.argv.slice(2);
const shoal = route === '--shoal';
const requireBands = expected === '--landfall-cues';
assert(route === undefined || shoal);
assert(expected === undefined || (shoal && requireBands));
assert(/^[a-zA-Z0-9_-]+$/.test(name));
assert(output && !fs.existsSync(output));
const sha = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(fs.readFileSync(`dist/${name}.json`));
const root = `dist/${name}/tidelands-local`;
assert.equal(sha(fs.readFileSync(`dist/${name}.zip`)),manifest.archiveSha256);
for (const [file, {sha256}] of Object.entries(manifest.files)) {
  assert.equal(sha(fs.readFileSync(`${root}/${file}`)),sha256,file);
  assert.equal(sha(fs.readFileSync(file==='README.md'?'docs/LOCAL-DELIVERY.md':file)),sha256,file);
}
const saveBytes = fs.readFileSync(saveFile), seed = JSON.parse(saveBytes);
const origin = 'http://127.0.0.1:4190', key = 'tidelands-save-v1';
const source = fs.readFileSync(`${root}/src/audio.js`,'utf8');
const observer = fs.readFileSync(new URL('./observe_main_mix.js',import.meta.url),'utf8');
const trace = `
const tracedUpdate=GameAudio.prototype.update,tracedEffect=GameAudio.prototype.effect;
let currentContact;
GameAudio.prototype.update=function(player,time,height,footfalls,options){
  currentContact={x:player.x,z:player.z,time,height,footfalls,previousFootfalls:this.lastFootfallCount,swimming:options?.swimming};
  try{return tracedUpdate.call(this,player,time,height,footfalls,options);}finally{currentContact=null;}
};
GameAudio.prototype.effect=function(kind,options){
  const result=tracedEffect.call(this,kind,options);
  if(mixRecording&&currentContact)mixEvents.at(-1).contact=currentContact;
  return result;
};
window.mainMix.ambience=()=>({wind:mixEngine.wind.gain.value,surf:mixEngine.surf.gain.value});`;
const deep = shoal ? {id:'shoal-crossing',type:'waypoint',x:44,z:100} : {id:'estuary-swim',type:'waypoint',x:59,z:-19};
const landing = shoal ? {id:'shoal-landing',type:'waypoint',x:86,z:139} : {id:'estuary-landing',type:'waypoint',x:77,z:-19};
const botanist = LANDMARKS.find(o=>o.id==='botanist');
const report = {
  complete:false, archiveSha256:manifest.archiveSha256, saveSha256:sha(saveBytes),
  scope:'1280/390 native Chromium with only the audio module observed. Real file input and held keys. Opus is a separate audio track.',
  rows:[], logs:[]
};
fs.mkdirSync(output,{recursive:true});
const {chromium} = await import(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const browser = await chromium.launch({headless:true,channel:'chromium',args:['--use-angle=metal']});
const contacts = bindCampaignContacts(world);
try {
  for (const width of [1280,390]) {
    const dir = path.join(output,String(width));
    fs.mkdirSync(dir);
    const audioFile = path.join(dir,'route.webm');
    const context = await browser.newContext({viewport:{width,height:width===390?844:800},recordVideo:{dir,size:{width:960,height:600}}});
    const page = await context.newPage();
    const phases = [], inputs = [];
    const read = () => page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const observe = async () => {await page.keyboard.press('1');return read();};
    const capture = async label => {
      const {player,time} = await observe();
      const {at,ambience} = await page.evaluate(()=>({at:window.mainMix.status().seconds,ambience:window.mainMix.ambience()}));
      await page.screenshot({path:path.join(dir,`${label}.jpg`),type:'jpeg',quality:87});
      const height = terrain(player.x,player.z);
      phases.push({label,x:player.x,z:player.z,height,time,at,ambience});
      return height;
    };
    const go = async target => {
      for (let i=0;i<80;i++) {
        const state = await observe();
        const step = nextInput({...state,requestedYaw:.15},target);
        if (step.reached) return;
        assert(step.key,`No route to ${target.id}`);
        inputs.push({target:target.id,key:step.key,ms:step.durationMs,x:state.player.x,z:state.player.z});
        await page.keyboard.down(step.key);
        try {await page.waitForTimeout(step.durationMs);} finally {await page.keyboard.up(step.key);}
      }
      throw Error(`Navigation budget exceeded for ${target.id}`);
    };
    page.setDefaultTimeout(90000);
    page.on('pageerror',e=>report.logs.push(e.message));
    page.on('console',e=>{if (['warning','error'].includes(e.type())) report.logs.push(e.text());});
    try {
      await context.exposeBinding('__mainMixSink',(_caller,bytes)=>fs.appendFileSync(audioFile,Buffer.from(bytes)));
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if (url.origin!==origin) return route.abort();
        if (url.pathname===`/${root}/src/audio.js`) {
          return route.fulfill({contentType:'application/javascript',body:`${source}\n${observer}\n${trace}`});
        }
        return route.continue();
      });
      await page.goto(`${origin}/${root}/`);
      await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
      await page.click('#start-button');
      await page.click('#pause-button');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();
      await (await chooser).setFiles(saveFile);
      await page.waitForFunction(()=>!document.querySelector('#panel').open && window.mainMix.status().context==='running');
      const restored = await read();
      assert(Math.hypot(restored.player.x-seed.player.x,restored.player.z-seed.player.z)<.01);
      await page.evaluate(()=>window.mainMix.start());
      await capture(shoal?'00-coast':'00-forest');
      await go(deep);
      assert(await capture('01-swimming') < WATER_LEVEL-1.8);
      await go(landing);
      const landHeight = await capture('02-landfall');
      assert(landHeight > WATER_LEVEL);
      if (shoal) {
        await go(world.objects.find(o=>o.id==='resource-1077'));
        assert.match(await page.locator('#interact-label').textContent(),/拾取贝壳/);
        await page.keyboard.press('e');
        await page.waitForTimeout(520);
        await capture('03-shell');
        await go({id:'shoal-ridge',type:'waypoint',x:110,z:159});
        assert(await capture('04-ridge') > landHeight+2);
      } else {
        await go(botanist);
        await page.keyboard.press('e');
        await page.waitForTimeout(200);
        assert.match(await page.locator('#toast').textContent(),/^林栖：/);
        await capture('03-botanist');
      }
      await page.click('#pause-button');
      await page.waitForTimeout(1800);
      const mix = await page.evaluate(()=>window.mainMix.stop());
      fs.writeFileSync(path.join(dir,'trace.json'),JSON.stringify({phases,inputs,mix},null,2)+'\n');
      assert.deepEqual(mix.errors,[]);
      assert.equal(mix.bytes,fs.statSync(audioFile).size);
      const cues = mix.events.filter(e=>e.contact);
      const counts = {};
      for (const cue of cues) {
        const {height, swimming, footfalls, previousFootfalls} = cue.contact;
        const {surface} = cue.options;
        assert(cue.after>cue.before && cue.active && cue.enabled,'A contact must start a live voice');
        assert.equal(swimming,surface==='swim');
        if (!swimming) assert(footfalls>previousFootfalls,'Grounded sounds follow a new footfall');
        if (surface==='wade') assert(height<WATER_LEVEL && height>WATER_LEVEL-1.8);
        if (cue.kind==='step') assert(height>=WATER_LEVEL);
        counts[surface]=(counts[surface]??0)+1;
      }
      const firstSwim=cues.findIndex(c=>c.options.surface==='swim');
      const lastSwim=cues.findLastIndex(c=>c.options.surface==='swim');
      assert(firstSwim>0 && lastSwim>firstSwim);
      assert(cues.slice(0,firstSwim).some(c=>c.options.surface==='wade'), 'Missing outbound wade');
      assert(cues.slice(lastSwim+1).some(c=>c.options.surface==='wade'), 'Missing inbound wade');
      for (const type of shoal ? ['sand','grass'] : ['litter','rock','gravel']) {
        assert(counts[type]>0,`Missing ${type} contact`);
      }
      if (requireBands) {
        const surfaces = cues.slice(lastSwim+1).map(c=>c.options.surface);
        let previous = -1;
        for (const surface of ['wade','wet-sand','gravel','grass']) {
          const next = surfaces.indexOf(surface,previous+1);
          assert(next>previous,`Missing ordered landfall cue ${surface}`);
          previous = next;
        }
      }

      const pcm = await page.evaluate(async({file,pausesAt})=>{
        const audio = new OfflineAudioContext(2,1,48000);
        const buffer = await audio.decodeAudioData(await (await fetch(file)).arrayBuffer());
        let peak=0,clipped=0,pausePeak=0;
        for (let c=0;c<buffer.numberOfChannels;c++) {
          const samples=buffer.getChannelData(c);
          for (let i=0;i<samples.length;i++) {
            const value=Math.abs(samples[i]);
            if (!Number.isFinite(value)) throw Error('Non-finite audio sample');
            peak=Math.max(peak,value);
            if (value>=.999) clipped++;
            if (i>(pausesAt+1)*buffer.sampleRate) pausePeak=Math.max(pausePeak,value);
          }
        }
        return {peak,clipped,pausePeak,duration:buffer.duration,rate:buffer.sampleRate,channels:buffer.numberOfChannels};
      },{file:`/${audioFile}`,pausesAt:mix.events.findLast(e=>e.method==='setActive'&&!e.value).at});
      assert(pcm.peak>0 && pcm.clipped===0 && pcm.pausePeak<.001 && pcm.channels===2);
      assert(Math.abs(pcm.duration-mix.seconds)<.4);
      await page.getByRole('button',{name:'保存进度',exact:true}).click();
      const saved = await page.evaluate(k=>localStorage.getItem(k),key);
      const final = JSON.parse(saved);
      assert.equal(final.quest,seed.quest);
      assert.equal(final.kills,seed.kills);
      if (shoal) {
        const hurt = mix.events.some(event=>event.kind==='hurt' && event.after>event.before);
        assert(final.player.hp>0 && final.player.hp<=seed.player.hp);
        assert.equal(final.player.hp<seed.player.hp,hurt);
      } else {
        assert.equal(final.player.hp,seed.player.hp);
      }
      assert.deepEqual(final.buildings,seed.buildings);
      assert.deepEqual(final.inventory,shoal?{...seed.inventory,shell:seed.inventory.shell+2}:seed.inventory);
      await page.reload();
      await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
      const startLabel = await page.locator('#start-button').textContent();
      const loadStatus = await page.locator('#load-status').textContent();
      await page.evaluate(()=>{document.querySelector('#start-button').click();document.querySelector('#pause-button').click();});
      const download = page.waitForEvent('download');
      await page.getByRole('button',{name:'导出存档',exact:true}).click();
      const exportPath=path.join(dir,'restored-live-export.json');
      await (await download).saveAs(exportPath);
      assertCameraRestoreEvidence({startLabel,loadStatus,exported:fs.readFileSync(exportPath,'utf8')},saved);
      const glError=await page.evaluate(()=>document.querySelector('#world').getContext('webgl2').getError());
      assert.equal(glError,0);
      report.rows.push({width,phases,counts,pcm,glError,restore:true,hp:{before:seed.player.hp,after:final.player.hp},savedSha256:sha(saved),audioSha256:sha(fs.readFileSync(audioFile))});
    } finally {
      fs.writeFileSync(path.join(dir,'route.json'),JSON.stringify({phases,inputs},null,2)+'\n');
      await context.close();
    }
  }
  assert.deepEqual(report.logs,[]);
  assert.equal(sha(fs.readFileSync(saveFile)),report.saveSha256);
  report.complete=true;
} catch(error) {report.error=error.stack;process.exitCode=1;console.error(error);}
finally {
  contacts.release();
  try {await browser.close();}
  finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
