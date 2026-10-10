import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio} from '../src/audio.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import * as THREE from '../vendor/three.module.min.js';
function context(){
  const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),connect(target){this.target=target;},disconnect(){this.disconnected=true;},start(...args){this.startArgs=args;},stop(){this.stopped=true;}});
  return {state:'running',sampleRate:100,currentTime:1,destination:node(),createGain:node,createBufferSource:node,createOscillator:node,createBiquadFilter:node,createBuffer:(_,n,rate)=>{const samples=new Float32Array(n);return {duration:n/rate,getChannelData:()=>samples};},async resume(){},async close(){this.state='closed';}};
}
test('mute prevents initialization and pause fades master to silence',async()=>{
  let made=0;const a=new GameAudio({enabled:false,contextFactory:()=>{made++;return context();}});
  await a.unlock();assert.equal(made,0);a.setEnabled(true);a.setActive(true);await a.unlock();assert.equal(made,1);assert.equal(a.master.gain.value,.35);
  a.setActive(false);assert.equal(a.master.gain.value,0);a.effect('hit');assert.equal(a.sources.size,0);
  a.setActive(true);a.setEnabled(false);assert.equal(a.master.gain.value,0);await a.dispose();
});
test('effects are bounded and disconnect on completion; footsteps follow distance',async()=>{
  const a=new GameAudio({contextFactory:context});a.setActive(true);await a.unlock();
  a.update({x:0,z:0},0,1);a.update({x:0,z:0},1,1);assert.equal(a.sources.size,0);
  a.update({x:2,z:0},2,1);assert.equal(a.sources.size,1);
  const source=[...a.sources][0];source.onended();assert.equal(a.sources.size,0);assert.equal(source.disconnected,true);
  for(let i=0;i<30;i++)a.effect('hit');
  for(let i=0;i<3;i++)a.effect('quest');assert.equal(a.sources.size,12);
  const ctx=a.context;await a.dispose();assert.equal(ctx.state,'closed');assert.equal(a.sources.size,0);
});
test('partial initialization and resume failures release context and allow a retry',async()=>{
  for(const failure of ['gain','resume']){
    const broken=context();
    if(failure==='gain')broken.createGain=()=>{throw new Error('gain unavailable');};
    else broken.resume=async()=>{throw new Error('resume unavailable');};
    let attempts=0;
    const a=new GameAudio({contextFactory:()=>attempts++===0?broken:context()});
    await assert.rejects(a.unlock(),/unavailable/);
    assert.equal(broken.state,'closed');assert.equal(a.context,null);
    assert.doesNotThrow(()=>{a.setEnabled(false);a.setActive(true);a.update({x:0,z:0},0,1);});
    a.setEnabled(true);await a.unlock();assert.equal(a.master.gain.value,.35);
    await a.dispose();await a.dispose();
  }
});

test('menu success cues play while world is paused, and mute silences both channels',async()=>{
  const a=new GameAudio({contextFactory:context});await a.unlock();
  assert.equal(a.master.gain.value,0);assert.equal(a.ui.gain.value,.35);
  a.effect('food',{menu:true});assert.equal(a.sources.size,1);
  const source=[...a.sources][0];assert.equal(source.target.target.target,a.ui);
  a.effect('hit',{menu:true});assert.equal(a.sources.size,1);
  a.setEnabled(false);assert.equal(a.ui.gain.value,0);assert.equal(a.master.gain.value,0);
  a.effect('craft',{menu:true});assert.equal(a.sources.size,1);
  const ui=a.ui;await a.dispose();assert.equal(ui.disconnected,true);
});
test('busy physical actions leave room for quest, crafting and food confirmation cues',async()=>{
  const a=new GameAudio({contextFactory:context});a.setActive(true);await a.unlock();
  for(let i=0;i<30;i++)a.effect('hit');
  for(const kind of ['quest','craft','food'])a.effect(kind);
  assert.equal([...a.sources].filter(source=>source.type==='sine').length,3);
  assert.ok(a.sources.size<=12);
  for(let i=0;i<30;i++)a.effect('quest');assert.equal(a.sources.size,12);
  await a.dispose();
});
test('ambient noise loops without a sample discontinuity or DC offset',async()=>{
  const a=new GameAudio({contextFactory:context});await a.unlock();
  const samples=a.noise.getChannelData(0);
  assert.ok(Math.abs(samples[0]-samples.at(-1))<1e-7);
  assert.ok(Math.abs(samples.reduce((sum,x)=>sum+x,0)/samples.length)<1e-7);
  assert.ok(samples.every(Number.isFinite));assert.ok(samples.some(x=>Math.abs(x)>.0001));
  await a.dispose();
});
test('physical actions vary noise slices without truncating tails or allocating new buffers',async()=>{
  const a=new GameAudio({contextFactory:context});a.setActive(true);await a.unlock();
  const offsets=[];
  for(let i=0;i<50;i++){
    a.effect('step');const source=[...a.sources][0];
    assert.equal(source.buffer,a.noise);assert.equal(source.startArgs[0],a.context.currentTime);
    const offset=source.startArgs[1];assert.ok(offset>=0&&offset+.11<=a.noise.duration);
    offsets.push(offset);source.onended();
  }
  assert.equal(new Set(offsets).size,50);assert.equal(a.sources.size,0);
  a.effect('quest');assert.deepEqual([...a.sources][0].startArgs,[a.context.currentTime]);
  await a.dispose();
});

test('distance fallback uses walking spacing, coast selects sand, swimming keeps splash spacing',()=>{
  const a=new GameAudio(),events=[];a.setActive(true);a.effect=(kind,options)=>events.push({kind,...options});
  a.update({x:0,z:0},0,5);
  for(let i=1;i<=90;i++)a.update({x:i*.1,z:0},i*.01,5);
  assert.equal(events.length,11);assert.ok(events.every(e=>e.kind==='step'&&e.surface==='grass'));
  a.setActive(false);a.setActive(true);events.length=0;
  a.update({x:0,z:0},0,1);a.update({x:1,z:0},1,1);
  assert.deepEqual(events,[{kind:'step',surface:'sand'}]);
  a.setActive(false);a.setActive(true);events.length=0;
  a.update({x:0,z:0},0,-1);a.update({x:1,z:0},1,-1);assert.equal(events.length,0);
  a.update({x:1.8,z:0},2,-1);assert.equal(events[0].kind,'splash');
  a.update({x:100,z:0},3,-1);assert.equal(events.length,1);
});

test('land audio follows actual rendered ankle touchdowns at walking and running speeds',()=>{
  for(const fps of [30,60,144])for(const speed of [2.4,7,12]){
    const c=createCharacter(),a=new GameAudio(),dt=1/fps,raised=[false,false];let sounds=0,visibleLandings=0;
    a.setActive(true);a.effect=kind=>{assert.equal(kind,'step');assert.ok(c.userData.footContacts.some(Boolean));sounds++;};
    animateCharacter(c,{x:0,z:0,yaw:0,time:0,attackAt:-100,selected:'hand'},dt,()=>0);a.update({x:0,z:0},0,5,c.userData.footfallCount);
    for(let frame=1;frame<=fps*4;frame++){
      const z=frame*dt*speed;c.position.z=z;animateCharacter(c,{x:0,z,yaw:0,time:frame*dt,attackAt:-100,selected:'hand'},dt,()=>0);c.updateMatrixWorld(true);
      for(let side=0;side<2;side++){
        const height=c.userData.ankles[side].getWorldPosition(new THREE.Vector3()).y;
        if(height>.15)raised[side]=true;
        if(raised[side]&&height<.14500001){visibleLandings++;raised[side]=false;}
      }
      a.update({x:0,z},frame*dt,5,c.userData.footfallCount);
    }
    assert.ok(sounds>4);assert.equal(sounds,visibleLandings);assert.equal(sounds,c.userData.footfallCount);
    a.update({x:0,z:c.position.z},5,5,c.userData.footfallCount);assert.equal(sounds,visibleLandings);
  }
});

test('contact counters suppress initial, replayed, paused and teleport steps while idle landings can sound',()=>{
  const a=new GameAudio(),events=[];a.setActive(true);a.effect=(kind,options)=>events.push({kind,...options});
  a.update({x:0,z:0},0,1,100);assert.equal(events.length,0);
  a.update({x:0,z:0},1,1,101);assert.deepEqual(events,[{kind:'step',surface:'sand'}]);
  a.update({x:0,z:0},2,1,101);assert.equal(events.length,1);
  a.setActive(false);a.update({x:0,z:0},3,1,102);a.setActive(true);a.update({x:0,z:0},4,1,103);assert.equal(events.length,1);
  a.update({x:100,z:0},5,5,104);assert.equal(events.length,1);
  a.update({x:100,z:0},6,5,105);assert.equal(events.at(-1).surface,'grass');assert.equal(events.length,2);
});

test('coastal surf fades through the shore elevation band without consuming effect voices',async()=>{
  const a=new GameAudio({contextFactory:context});a.setActive(true);await a.unlock();
  assert.ok(a.surfSource,'wind alone must not stand in for a coastal surf layer');
  assert.equal(a.surfSource.buffer,a.noise);assert.equal(a.surfSource.loop,true);
  assert.equal(a.surfSource.target.target.target,a.master);
  const source=a.surfSource,buffer=a.noise,levels=[];
  for(const height of [-1,0,1,2,3,4,5,10]){
    a.update({x:0,z:0},5,height,0);levels.push(a.surf.gain.value);
  }
  assert.ok(levels[0]>0);assert.equal(levels[0],levels[1]);
  for(let i=2;i<levels.length;i++)assert.ok(levels[i]<=levels[i-1]);
  assert.ok(levels[4]>0&&levels[4]<levels[1]);assert.equal(levels.at(-1),0);
  assert.equal(a.sources.size,0);assert.equal(a.surfSource,source);assert.equal(a.noise,buffer);
  a.update({x:0,z:0},7,0,0);assert.notEqual(a.surf.gain.value,levels[1]);
  await a.dispose();
});

test('surf shares world mute/pause and releases all persistent nodes on disposal',async()=>{
  const a=new GameAudio({contextFactory:context});a.setActive(true);await a.unlock();
  assert.ok(a.surfSource);const source=a.surfSource,filter=a.surfFilter,gain=a.surf;
  a.setActive(false);assert.equal(a.master.gain.value,0);assert.equal(a.ui.gain.value,.35);
  a.setActive(true);a.setEnabled(false);assert.equal(a.master.gain.value,0);
  await a.dispose();assert.equal(source.stopped,true);assert.equal(source.disconnected,true);
  assert.equal(filter.disconnected,true);assert.equal(gain.disconnected,true);
  assert.equal(a.surfSource,null);assert.equal(a.surfFilter,null);assert.equal(a.surf,null);
});
