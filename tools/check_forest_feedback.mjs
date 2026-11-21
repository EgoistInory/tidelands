import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {world,nextInput} from './journey_path.mjs';
import {bindCampaignContacts} from './campaign_contact_plan.mjs';
import {assertCameraRestoreEvidence} from './camera_policy_qa.mjs';

const [name,out,history,expected='spatial']=process.argv.slice(2);
assert(/^[a-zA-Z0-9_-]+$/.test(name)&&out&&!fs.existsSync(out));
assert(['centered','spatial'].includes(expected));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=`dist/${name}/tidelands-local`,key='tidelands-save-v1',origin='http://127.0.0.1:4190';
const manifest=JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(fs.readFileSync(`dist/${name}.zip`)),manifest.archiveSha256);
for(const [file,{sha256}] of Object.entries(manifest.files))assert.equal(sha(fs.readFileSync(`${root}/${file}`)),sha256,file);
const original=fs.readFileSync(history),seed=JSON.parse(original);
const report={complete:false,expected,archiveSha256:manifest.archiveSha256,saveSha256:sha(original),rows:[],logs:[],scope:'Native Chromium and a historical normal save. Audio and the impact pool are observed without altering the game state.'};
const audioTrace=`
window.forestFeedback={sounds:[],impacts:[]};
const tracedEffect=GameAudio.prototype.effect;
GameAudio.prototype.effect=function(kind,options){
  const before=this.sources.size;
  const result=tracedEffect.call(this,kind,options);
  if(kind==='hit'||kind==='gather'){
    const source=this.sources.size>before?[...this.sources].at(-1):null;
    window.forestFeedback.sounds.push({kind,options,played:!!source});
  }
  return result;
};`;
const sceneTrace=`
const tracedDraw=WorldView.prototype.draw,observed=new WeakSet();
WorldView.prototype.draw=function(...args){
  if(!observed.has(this)){
    observed.add(this);
    const spawn=this.impacts.spawn;
    this.impacts.spawn=cue=>{
      window.forestFeedback.impacts.push(cue);
      return spawn(cue);
    };
  }
  return tracedDraw.apply(this,args);
};`;
const contacts=bindCampaignContacts(world);
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
fs.mkdirSync(out,{recursive:true});
try {
  for(const width of (expected==='centered'?[1280]:[1280,390])){
    const dir=path.join(out,String(width));fs.mkdirSync(dir);
    const context=await browser.newContext({viewport:{width,height:width===390?844:800},recordVideo:{dir,size:{width:960,height:600}}});
    const page=await context.newPage(),inputs=[],phases=[];
    let rest=null;
    page.on('pageerror',e=>report.logs.push(e.message));
    page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
    const press=async key=>{inputs.push({key});await page.keyboard.press(key);};
    const walk=async(key,ms)=>{
      inputs.push({key,ms});await page.keyboard.down(key);
      try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}
    };
    const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const observe=async()=>{await press('1');return read();};
    const go=async(target,interaction)=>{
      for(let i=0;i<150;i++){
        const state=await observe();
        if(interaction && Math.hypot(target.x-state.player.x,target.z-state.player.z)<8 &&
           (await page.locator('#interact-label').textContent()).includes(interaction))return;
        const route=nextInput({...state,requestedYaw:.15},target);
        if(route.reached&&!interaction)return;
        const key=route.reached?direction(state.player,target):route.key;
        assert(key,`No route to ${target.id}`);await walk(key,route.reached?100:route.durationMs);
      }
      throw Error(`Navigation budget exceeded for ${target.id}`);
    };
    const capture=async(label,state)=> {
      const image=label+'.jpg';await page.screenshot({path:path.join(dir,image),type:'jpeg',quality:86});
      phases.push({label,player:state.player,kills:state.kills,wood:state.inventory.wood,berry:state.inventory.berry,image});
    };
    try {
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin)return route.abort();
        const trace=url.pathname===`/${root}/src/audio.js`?audioTrace:url.pathname===`/${root}/src/scene.js`?sceneTrace:null;
        return trace?route.fulfill({contentType:'application/javascript',body:fs.readFileSync('.'+url.pathname,'utf8')+'\n'+trace}):route.continue();
      });
      await page.goto(`${origin}/${root}/`);
      await page.waitForFunction(()=>!document.querySelector('#start-button').disabled,{},{timeout:90000});
      await page.click('#start-button');await page.click('#pause-button');
      const chooser=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();
      await (await chooser).setFiles(history);
      await page.waitForFunction(()=>!document.querySelector('#panel').open);
      await capture('00-start',await observe());
      const berry=world.objects.find(o=>o.id==='resource-170');
      await go(berry,'采集浆果');
      await press('e');await page.waitForTimeout(520);
      let state=await observe();
      assert.equal(state.inventory.berry,seed.inventory.berry+2);
      await capture('01-gather',state);
      const encounter=state.enemies.find(e=>e.id==='enemy-37');
      assert(encounter?.hp>0);
      await go({...encounter,type:'npc'});
      for(let i=0;i<18&&state.kills===seed.kills;i++){
        state=await observe();const enemy=state.enemies.find(e=>e.id===encounter.id);
        await walk(direction(state.player,enemy),90);await press('2');await press('Space');
        await page.waitForTimeout(670);state=await observe();
      }
      assert.equal(state.kills,seed.kills+1);
      await capture('02-encounter',state);
      const cues=await page.evaluate(()=>window.forestFeedback);
      fs.writeFileSync(path.join(dir,'feedback.json'),JSON.stringify(cues,null,2)+'\n');
      for(const kind of ['gather','hit']){
        const sounds=cues.sounds.filter(e=>e.kind===kind);assert(sounds.length>0&&sounds.every(e=>e.played));
        for(const sound of sounds){
          if(expected==='centered')assert.equal(sound.options.pan,undefined);
          else assert(Number.isFinite(sound.options.pan)&&sound.options.volume>.8);
        }
      }
      assert(cues.impacts.some(c=>c.kind==='berry')&&cues.impacts.some(c=>c.kind==='hit'&&c.id===encounter.id));
      if(expected==='spatial')assert(cues.sounds.some(e=>Math.abs(e.options.pan)>.05));
      if(expected==='spatial'){
        const camp=state.buildings.find(b=>b.type==='campfire');
        await go(camp,'休息');const before=await observe();
        await press('e');await page.waitForTimeout(260);state=await observe();
        assert.equal(state.player.hp,100);
        assert.match(await page.locator('#toast').textContent(),/^火光/);
        await capture('03-camp',state);
        rest={before:before.player.hp,after:state.player.hp};
      }
      assert.equal(state.quest,seed.quest);assert.deepEqual(state.buildings,seed.buildings);
      await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();
      const saved=await page.evaluate(key=>localStorage.getItem(key),key);
      await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled,{},{timeout:90000});
      const startLabel=await page.locator('#start-button').textContent(),loadStatus=await page.locator('#load-status').textContent();
      await page.evaluate(()=>{document.querySelector('#start-button').click();document.querySelector('#pause-button').click();});
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'导出存档',exact:true}).click();const receipt=await download;
      const exported=path.join(dir,'restored-live-export.json');await receipt.saveAs(exported);
      assertCameraRestoreEvidence({startLabel,loadStatus,exported:fs.readFileSync(exported,'utf8')},saved);
      const glError=await page.evaluate(()=>document.querySelector('#world').getContext('webgl2').getError());
      assert.equal(glError,0);
      report.rows.push({width,phases,cues,rest,restored:true,savedSha256:sha(saved),glError});
    }finally{
      fs.writeFileSync(path.join(dir,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
      await context.close();
    }
  }
  assert.deepEqual(report.logs,[]);assert.equal(sha(fs.readFileSync(history)),report.saveSha256);
  report.complete=true;
}catch(error){
  report.error=error.stack;process.exitCode=1;console.error(error);
}finally{
  contacts.release();await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}

function direction(from,to){
  const dx=to.x-from.x,dz=to.z-from.z,cs=Math.cos(.15),sn=Math.sin(.15);
  const x=dx*cs-dz*sn,z=dx*sn+dz*cs;
  return Math.abs(x)>Math.abs(z)?(x>0?'d':'a'):(z>0?'s':'w');
}
