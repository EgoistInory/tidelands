// Native file import and keyboard traversal on the untouched extracted release.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {HIGHLAND_ASCENT,highlandAscent} from '../src/highland-ascent.js';
import {LANDMARKS,terrain} from '../src/world.js';
import {world,nextInput} from './journey_path.mjs';
import {bindCampaignContacts} from './campaign_contact_plan.mjs';
import {assertCameraRestoreEvidence} from './camera_policy_qa.mjs';
import {profileRoute,routeViewport,routeRequests,startRouteProfile,stopRouteProfile} from './route-frame-profile.mjs';

const [name,out,...checks]=process.argv.slice(2);
const checkDialogue=checks.includes('--check-dialogue'),measureMotion=checks.includes('--observe-motion');
assert(!measureMotion||checkDialogue&&!profileRoute);
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
if(profileRoute)report.scope='Ordinary historical save, native inputs and clock. Only scene response appends read-only complete-draw GPU/CPU measurement. No video recording during timing.';
if(measureMotion)report.scope='Ordinary saved state and native ascent. Scene response adds read-only motion samples, audio response adds an isolated stereo recorder. Sound and silent video are separate captures.';
const contacts=bindCampaignContacts(world);
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chromium',headless:true,args:['--use-angle=metal']});
fs.mkdirSync(out,{recursive:true});
try{
  for(const width of [1280,390]){
    const dir=path.join(out,String(width));fs.mkdirSync(dir);
    const context=await browser.newContext({...routeViewport(width),hasTouch:checkDialogue&&width===390,
      ...(profileRoute?{}:{recordVideo:{dir,size:{width:960,height:600}}})});
    const page=await context.newPage(),inputs=[],phases=[];
    const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const observe=async()=>{await page.keyboard.press('1');return read();};
    const capture=async label=>{
      const s=await observe(),{player,time}=s,image=label+'.jpg',height=terrain(player.x,player.z);
      await page.screenshot({path:path.join(dir,image),type:'jpeg',quality:87});
      phases.push({label,player,time,height,wear:highlandAscent(player.x,player.z,height)?.wear??0,image,sha256:sha(fs.readFileSync(path.join(dir,image)))});
      return s;
    };
    const go=async(point,speaker=null)=>{
      const [x,z]=Array.isArray(point)?point:HIGHLAND_ASCENT[point],target={id:`ascent-${x}-${z}`,x,z,type:'waypoint'};
      for(let n=0;n<55;n++){
        const s=await observe(),dx=x-s.player.x,dz=z-s.player.z;
        if(speaker&&Math.hypot(dx,dz)<4&&(await page.locator('#interact-label').textContent()).includes(speaker))return;
        const route=nextInput({...s,requestedYaw:.15},target);
        if(route.reached&&!speaker)return;
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
      await routeRequests(context,origin,root,dir);
      const audioPath=path.join(dir,'route-audio.webm'),motionPath=path.join(dir,'motion.json');
      if(measureMotion){
        await context.exposeBinding('__mainMixSink',(_source,bytes)=>fs.appendFileSync(audioPath,Buffer.from(bytes)));
        const observers={'scene.js':'tools/observe_highland_motion.js','audio.js':'tools/observe_main_mix.js'};
        await context.route('**/src/*.js',route=>{
          const url=new URL(route.request().url()),file=path.basename(url.pathname);
          if(url.origin!==origin||url.pathname!==`/${root}/src/${file}`||!observers[file])return route.fallback();
          return route.fulfill({contentType:'application/javascript',
            body:fs.readFileSync(`${root}/src/${file}`,'utf8')+'\n'+fs.readFileSync(observers[file],'utf8')});
        });
      }
      await page.goto(`${origin}/${root}/`);
      await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
      await page.click('#start-button');await page.click('#pause-button');
      const file=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await file).setFiles(history);
      await page.waitForFunction(()=>!document.querySelector('#panel').open);
      const initial=await capture('00-import');
      assert(Math.hypot(initial.player.x-seed.player.x,initial.player.z-seed.player.z)<.01);
      await startRouteProfile(page);
      for(const i of [5,4,3,2,1,0])await go(i);
      let shoreHeight;
      if(checkDialogue){
        await go([-79,-143]);
        const {player}=await observe();
        shoreHeight=terrain(player.x,player.z);
        assert(shoreHeight<1.2,`Shore height: ${shoreHeight} at ${player.x}, ${player.z}`);
        if(measureMotion){
          await page.waitForFunction(()=>window.mainMix?.status().context==='running');
          await page.evaluate(()=>{window.mainMix.start();window.highlandMotion.active=true;});
        }
        await go(0);
      }
      await capture('01-foot');
      for(const i of [1,2,3])await go(i);
      await capture('02-ascent');
      for(const i of [4,5])await go(i);
      await go(6,'远舟');
      if(checkDialogue&&width===390)await page.locator('#interact-button').tap();
      else await page.keyboard.press('e');
      await page.waitForTimeout(230);
      assert.match(await page.locator('#toast').textContent(),/^远舟：/);
      let dialogue;
      if(checkDialogue){
        dialogue=await page.evaluate(()=>{
          const toast=document.querySelector('#toast');
          const rect=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
          return {marked:toast.hasAttribute('data-dialogue'),toast:rect('#toast'),vitals:rect('.vitals'),
            map:rect('.map-corner'),prompt:rect('#interact-button'),questDisplay:getComputedStyle(document.querySelector('.quest')).display,
            fitsText:toast.scrollWidth<=toast.clientWidth};
        });
        assert(dialogue.marked&&dialogue.fitsText);
        if(width===390){
          assert.equal(dialogue.questDisplay,'none');
          assert(dialogue.toast.top>=dialogue.vitals.bottom&&dialogue.toast.right<=dialogue.map.left&&
            dialogue.toast.bottom<dialogue.prompt.top&&dialogue.toast.top<=150);
        }
      }
      const final=await capture('03-lookout');
      assert(phases[3].height-phases[1].height>19 && phases[2].height>phases[1].height+8);
      assert.equal(final.quest,seed.quest);assert.equal(final.kills,seed.kills);assert(final.player.hp>0);
      assert.deepEqual(final.buildings,seed.buildings);assert.deepEqual(final.inventory,seed.inventory);
      let motion;
      if(measureMotion){
        await page.waitForTimeout(1250);
        const {frames,mix}=await page.evaluate(async()=>{
          window.highlandMotion.active=false;
          return {frames:window.highlandMotion.frames,mix:await window.mainMix.stop()};
        });
        assert(frames.length>180&&frames.some(f=>f.explorer.step!==null));
        assert.equal(mix.errors.length,0);assert.equal(mix.pending,0);
        fs.writeFileSync(motionPath,JSON.stringify({frames,mix})+'\n');
        const audio=fs.readFileSync(audioPath),pcm=await page.evaluate(async bytes=>{
          const context=new OfflineAudioContext(2,1,48000);
          const buffer=await context.decodeAudioData(Uint8Array.from(atob(bytes),ch=>ch.charCodeAt(0)).buffer);
          let peak=0,clipped=0;
          for(let j=0;j<buffer.numberOfChannels;j++)for(const value of buffer.getChannelData(j)){
            peak=Math.max(peak,Math.abs(value));clipped+=Number(Math.abs(value)>=.999);
          }
          return {seconds:buffer.duration,channels:buffer.numberOfChannels,peak,clipped};
        },audio.toString('base64'));
        assert(pcm.seconds>5&&pcm.channels===2&&pcm.peak>.01&&pcm.clipped===0);
        const footsteps=mix.events.filter(e=>e.kind==='step'&&e.after>e.before).map(e=>e.options.surface);
        assert(footsteps.length>6&&mix.bytes===audio.length);
        motion={frames:frames.length,bodySteps:frames.at(-1).player.footfalls-frames[0].player.footfalls,
          explorerStepFrames:frames.filter(f=>f.explorer.step!==null).length,
          footsteps:Object.fromEntries([...new Set(footsteps)].map(s=>[s,footsteps.filter(t=>t===s).length])),
          pcm,audioSha256:sha(audio),framesSha256:sha(fs.readFileSync(motionPath))};
      }
      const timing=await stopRouteProfile(page,dir);
      await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();
      if(checkDialogue){
        assert.equal(await page.locator('#toast').getAttribute('data-dialogue'),null);
        assert(await page.locator('.quest').evaluate(quest=>getComputedStyle(quest).display!=='none'));
      }
      const saved=await page.evaluate(k=>localStorage.getItem(k),key);
      await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);
      const startLabel=await page.locator('#start-button').textContent(),loadStatus=await page.locator('#load-status').textContent();
      await page.evaluate(()=>{document.querySelector('#start-button').click();document.querySelector('#pause-button').click();});
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'导出存档',exact:true}).click();
      const exported=path.join(dir,'restored-live-export.json');await(await download).saveAs(exported);
      assertCameraRestoreEvidence({startLabel,loadStatus,exported:fs.readFileSync(exported,'utf8')},saved);
      const glError=await page.evaluate(()=>document.querySelector('#world').getContext('webgl2').getError());
      assert.equal(glError,0);report.rows.push({width,phases,restore:true,glError,savedSha256:sha(saved),
        ...(timing?{timing}:{}),...(dialogue?{dialogue,shoreHeight}:{}),...(motion?{motion}:{})});
      if(checkDialogue&&width===390){
        // This browser context owns a disposable test copy, already exported above.
        await page.getByRole('button',{name:'开始新旅程',exact:true}).click();
        await page.locator('#confirm-new').click();
        const {x,z}=LANDMARKS.find(o=>o.id==='keeper');
        await go([x,z],'阿岚');
        await page.locator('#interact-button').tap();
        const message=await page.locator('#toast').textContent();
        assert.match(message,/新的目标/);
        assert.equal(await page.locator('#toast').getAttribute('data-dialogue'),'');
        assert.equal((await read()).quest,1);
        report.questDialogue={width,quest:1,message};
      }
    }finally{
      fs.writeFileSync(path.join(dir,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
      await context.close();
    }
  }
  assert.deepEqual(report.logs,[]);assert.equal(sha(fs.readFileSync(history)),report.saveSha256);
  report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{contacts.release();try{await browser.close();}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
