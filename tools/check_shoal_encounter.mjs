// Native controls and a historical save at the Amber Shoal inland encounter.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assertCameraRestoreEvidence} from './camera_policy_qa.mjs';

const [name,out,saveFile,mode,motion]=process.argv.slice(2),strict=mode==='--aligned',recordMotion=motion==='--boar-motion';
assert(/^[a-zA-Z0-9_-]+$/.test(name)&&out&&!fs.existsSync(out));
assert(mode===undefined||strict||mode==='--observe');
assert(motion===undefined||recordMotion);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=`dist/${name}/tidelands-local`,origin='http://127.0.0.1:4190',key='tidelands-save-v1';
const manifest=JSON.parse(fs.readFileSync(`dist/${name}.json`));
assert.equal(sha(fs.readFileSync(`dist/${name}.zip`)),manifest.archiveSha256);
for(const [file,{sha256}] of Object.entries(manifest.files))assert.equal(sha(fs.readFileSync(`${root}/${file}`)),sha256,file);
const original=fs.readFileSync(saveFile),seed=JSON.parse(original);
const report={complete:false,archiveSha256:manifest.archiveSha256,saveSha256:sha(original),rows:[],logs:[],
  scope:'The original entry and a normal saved encounter. Only the scene response appends a draw observer. Native aim, attacks and food; actual scene cue and HUD read together.'};
const trace=`
const nativeDraw=WorldView.prototype.draw;
const encounters={active:false,frames:[],latest:null,types:new Set()};
window.shoalEncounter=encounters;
WorldView.prototype.draw=function(state,...args){
  if(!encounters.active)return nativeDraw.call(this,state,...args);
  let marked=null;
  const update=this.windupCue.update;
  this.windupCue.update=(windup,time)=>{
    update(windup,time);
    if(this.windupCue.mesh.visible)marked={id:windup.enemy.id,type:windup.enemy.type};
  };
  try{nativeDraw.call(this,state,...args);}finally{this.windupCue.update=update;}
  const p=state.player,near=state.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<15).sort((a,b)=>
    Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).map(({id,type,hp,x,z})=>({id,type,hp,x,z}));
  const el=id=>document.getElementById(id),hud=el('enemy-status'),hurt=el('hurt-feedback'),toast=el('toast');
  const rect=hurt.getBoundingClientRect(),covered=(bone,height)=>{
    const point=this.player.getObjectByName(bone)?.getWorldPosition(new THREE.Vector3())??this.player.position.clone().add(new THREE.Vector3(0,height,0));
    const screen=point.project(this.camera),x=(screen.x+1)*innerWidth/2,y=(1-screen.y)*innerHeight/2;
    return !hurt.hidden&&screen.z>-1&&screen.z<1&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
  };
  if(marked)encounters.types.add(marked.type);
  let boar=null;
  if(${recordMotion})for(const e of near){
    if(e.type!=='boar')continue;
    const pose=enemyAttackPose(state,e),rig=this.creatures.get(e.id);
    if(!pose||!rig)continue;
    const muzzle=rig.userData.body.localToWorld(new THREE.Vector3(0,1.03,1.995));
    const yaw=rig.rotation.y;
    boar={id:e.id,age:state.time-pose.at,attackAt:pose.at,root:rig.position.toArray(),bodyShift:rig.userData.body.position.z,
      reach:(muzzle.x-e.x)*Math.sin(yaw)+(muzzle.z-e.z)*Math.cos(yaw),
      planted:rig.userData.footContacts?.filter(Boolean).length??0};
    break;
  }
  const row={time:state.time,hp:p.hp,player:{x:p.x,z:p.z},yaw:this.yaw,kills:state.kills,food:state.inventory.berry+state.inventory.meal,near,marked,
    hud:{name:el('enemy-name').textContent,danger:hud.hidden?null:hud.dataset.danger},
    attack:el('attack-feedback').hidden?null:el('attack-feedback').textContent, hurt:hurt.hidden?null:hurt.textContent,
    hurtTop:hurt.hidden?null:rect.top,bodyCovered:covered('head',1.45)||covered('spine_03',1.12),
    types:[...encounters.types],duplicate:!toast.hidden&&toast.textContent.startsWith('受到攻击！'),boar};
  encounters.latest=row;
  if(encounters.frames.length<3200)encounters.frames.push(row);
};`;
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{
  for(const width of [1280,390]){
    const dir=path.join(out,String(width));fs.mkdirSync(dir);
    const viewport={width,height:width===390?844:800};
    const context=await browser.newContext({viewport,...(recordMotion?{recordVideo:{dir,size:viewport}}:{})});
    const page=await context.newPage();
    const inputs=[];
    const latest=()=>page.evaluate(()=>window.shoalEncounter.latest);
    const press=async key=>{inputs.push({key});await page.keyboard.press(key);};
    const hold=async(key,ms)=>{
      inputs.push({key,ms});await page.keyboard.down(key);
      try{await page.waitForTimeout(ms);}finally{await page.keyboard.up(key);}
    };
    page.on('pageerror',error=>report.logs.push(error.message));
    page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});
    try{
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin)return route.abort();
        if(url.pathname===`/${root}/src/scene.js`)return route.fulfill({
          contentType:'application/javascript',body:fs.readFileSync(`${root}/src/scene.js`,'utf8')+trace
        });
        return route.continue();
      });
      await page.goto(`${origin}/${root}/`);
      await page.waitForFunction(()=>!document.querySelector('#start-button').disabled,undefined,{timeout:90000});
      await page.click('#start-button');await page.click('#pause-button');
      const file=page.waitForEvent('filechooser');
      await page.getByRole('button',{name:'导入存档',exact:true}).click();
      await page.evaluate(()=>{window.shoalEncounter.active=true;});
      await(await file).setFiles(saveFile);
      await page.waitForFunction(()=>!document.querySelector('#panel').open);
      await press('2');
      await page.waitForFunction(()=>window.shoalEncounter.latest?.hurt,undefined,{timeout:8000});
      await page.screenshot({path:path.join(dir,'hurt.jpg'),type:'jpeg',quality:88});
      const {x,y,width:viewWidth,height}=await page.locator('#world').boundingBox();
      const dragX=x+viewWidth*.23,dragY=y+height*.56;
      assert(await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.id==='world',[dragX,dragY]));
      for(let i=0;i<3;i++){
        await page.mouse.move(dragX,dragY);await page.mouse.down();
        await page.mouse.move(dragX+126,dragY,{steps:5});await page.mouse.up();
      }
      inputs.push({dragX:378});
      for(let i=0;i<14;i++){
        const state=await latest();
        if(state.hp<54&&state.food)await press('3');
        if(!state.near.length||(state.kills>seed.kills&&state.types.length===2))break;
        const enemy=state.near[0],dx=enemy.x-state.player.x,dz=enemy.z-state.player.z;
        const sin=Math.sin(state.yaw),cos=Math.cos(state.yaw),x=dx*cos-dz*sin,z=dx*sin+dz*cos;
        await hold(Math.abs(x)>Math.abs(z)?(x>0?'d':'a'):(z>0?'s':'w'),90);
        if(width===390){inputs.push({button:'attack'});await page.click('#attack-button');}
        else await press('Space');
        await page.waitForTimeout(580);
      }
      const frames=await page.evaluate(()=>{window.shoalEncounter.active=false;return window.shoalEncounter.frames;});
      fs.writeFileSync(path.join(dir,'frames.json'),JSON.stringify(frames,null,2)+'\n');
      const last=frames.at(-1),cues=frames.filter(f=>f.marked),hurt=frames.filter(f=>f.hurt);
      const mismatch=cues.filter(f=>f.hud.danger!=='windup'||f.hud.name!==(f.marked.type==='boar'?'野猪':'海岸蟹'));
      const size=frames.filter(f=>new Set(f.near.filter(e=>Math.hypot(e.x-f.player.x,e.z-f.player.z)<8).map(e=>e.type)).size===2).length;
      assert(size>0&&last.types.length===2&&hurt.length>0&&frames.some(f=>f.attack?.match(/命中|击败/)));
      assert(last.kills>seed.kills&&last.hp>0);
      const counts={mixed:size,cues:cues.length,mismatch:mismatch.length,hurt:hurt.length,
        duplicate:frames.filter(f=>f.duplicate).length,bodyCovered:hurt.filter(f=>f.bodyCovered).length};
      let motionEvidence;
      if(recordMotion){
        const strike=frames.find(f=>f.boar)?.boar;
        assert(strike,'Missing a native boar strike');
        const samples=frames.map(f=>f.boar).filter(f=>f?.attackAt===strike.attackAt&&f.id===strike.id);
        const loading=samples.filter(f=>f.age>.085&&f.age<.18),contact=samples.filter(f=>f.age>.278&&f.age<.36);
        assert(loading.length&&contact.length,'Missing recorded loading or contact');
        const back=loading.reduce((a,b)=>a.bodyShift<b.bodyShift?a:b);
        const forward=contact.reduce((a,b)=>a.bodyShift>b.bodyShift?a:b);
        assert.deepEqual(back.root,forward.root);
        if(strict)assert(back.planted>=2&&forward.planted>=2&&back.bodyShift<-.15&&forward.bodyShift>.28&&forward.reach-back.reach>.35);
        motionEvidence={samples:samples.length,loading:back,contact:forward};
      }
      if(strict){
        assert.equal(counts.mismatch,0);assert.equal(counts.duplicate,0);
        if(width===390)assert.equal(counts.bodyCovered,0);
      }
      await page.click('#pause-button');
      assert(await page.locator('#combat-feedback').evaluate(node=>node.hidden));
      await page.getByRole('button',{name:'保存进度',exact:true}).click();
      const saved=await page.evaluate(key=>localStorage.getItem(key),key),final=JSON.parse(saved);
      assert.equal(final.quest,seed.quest);assert.deepEqual(final.buildings,seed.buildings);
      assert.equal(final.inventory.shell,seed.inventory.shell);
      await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled,undefined,{timeout:90000});
      const startLabel=await page.locator('#start-button').textContent(),loadStatus=await page.locator('#load-status').textContent();
      await page.evaluate(()=>{document.querySelector('#start-button').click();document.querySelector('#pause-button').click();});
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'导出存档',exact:true}).click();
      const exported=path.join(dir,'restored-live-export.json');await(await download).saveAs(exported);
      assertCameraRestoreEvidence({startLabel,loadStatus,exported:fs.readFileSync(exported,'utf8')},saved);
      const glError=await page.evaluate(()=>document.querySelector('#world').getContext('webgl2').getError());
      assert.equal(glError,0);
      report.rows.push({width,counts,motion:motionEvidence,cueTypes:[...new Set(cues.map(f=>f.marked.type))],hp:[seed.player.hp,final.player.hp],
        kills:[seed.kills,final.kills],restored:true,glError,hurtImageSha256:sha(fs.readFileSync(path.join(dir,'hurt.jpg')))});
      console.log(JSON.stringify(report.rows.at(-1)));
    }finally{
      fs.writeFileSync(path.join(dir,'inputs.json'),JSON.stringify(inputs,null,2)+'\n');
      await context.close();
    }
  }
  assert.deepEqual(report.logs,[]);assert.equal(sha(fs.readFileSync(saveFile)),report.saveSha256);
  report.complete=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{try{await browser.close();}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
