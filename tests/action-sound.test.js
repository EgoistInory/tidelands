import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio} from '../src/audio.js';

function rig(){
  const param=()=>({value:0,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.peak=v;},exponentialRampToValueAtTime(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),connect(to){this.to=to;},disconnect(){this.disconnected=true;},start(){},stop(time){this.stopTime=time;}});
  const audio=new GameAudio();Object.assign(audio,{active:true,context:{state:'running',currentTime:1,createGain:node,createBiquadFilter:node,createBufferSource:node},master:node(),noise:{duration:3}});
  return audio;
}
function sample(audio,kind,options){
  audio.effect(kind,options);const source=[...audio.sources].at(-1),filter=source.to,gain=filter.to;
  const result={frequency:filter.frequency.value,length:source.stopTime-1,level:gain.gain.peak};
  source.onended();assert.equal(audio.sources.size,0);assert.ok(source.disconnected&&filter.disconnected&&gain.disconnected);
  return result;
}
test('confirmed wood, rock and soft pickups have distinct bounded physical cues',()=>{
  const a=rig(),wood=sample(a,'gather',{surface:'tree'}),stone=sample(a,'gather',{surface:'stone'}),leaf=sample(a,'gather',{surface:'fiber'});
  assert.ok(stone.frequency>wood.frequency*2,'stone must not sound like the same filtered wood hit');
  assert.ok(leaf.level<wood.level&&leaf.length<wood.length,'a soft pickup must not have the axe impact envelope');
  for(const surface of ['tree','stone','crystal','berry','fiber','shell','unknown']){
    const r=sample(a,'gather',{surface});assert.ok(r.frequency>=100&&r.frequency<=4000&&r.length>0&&r.length<.5&&r.level<=.55);
  }
});
test('weapon swing and confirmed shell/flesh hit preserve their physical identity',()=>{
  const a=rig(),hand=sample(a,'swing',{weapon:'hand'}),axe=sample(a,'swing',{weapon:'axe'}),sword=sample(a,'swing',{weapon:'sword'});
  assert.ok(sword.frequency>axe.frequency&&axe.frequency>hand.frequency);
  const shell=sample(a,'hit',{enemyType:'crab'}),flesh=sample(a,'hit',{enemyType:'boar'});
  assert.ok(shell.frequency>flesh.frequency*2&&shell.length<flesh.length);
});
test('incoming injury has a longer lower cue than outgoing impact without bypassing mute, pause or capacity',()=>{
  const a=rig(),hurt=sample(a,'hurt'),hit=sample(a,'hit');assert.ok(hurt.frequency<hit.frequency&&hurt.length>hit.length);
  a.enabled=false;a.effect('hurt');assert.equal(a.sources.size,0);a.enabled=true;a.active=false;a.effect('hurt');assert.equal(a.sources.size,0);
  a.active=true;for(let i=0;i<30;i++)a.effect('hurt');assert.equal(a.sources.size,9);
});
