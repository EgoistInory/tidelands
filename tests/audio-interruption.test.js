import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio} from '../src/audio.js';

function rig(){
 const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},cancelScheduledValues(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),connect(to){this.to=to;},disconnect(){this.disconnected=true;},start(){},stop(time){this.stopAt=time;}});
 const audio=new GameAudio(),ctx={state:'running',currentTime:1,createGain:node,createBiquadFilter:node,createBufferSource:node,createOscillator:node};
 Object.assign(audio,{active:true,context:ctx,master:node(),ui:node(),noise:{duration:3}});return {audio,ctx};
}
test('pause cancels active world warnings and strikes while preserving paused-menu feedback',()=>{
 const {audio,ctx}=rig();audio.effect('enemy-windup');audio.effect('swing');audio.effect('quest');audio.effect('food',{menu:true});
 const voices=[...audio.sources],menu=voices.at(-1),menuEnd=menu.stopAt;ctx.currentTime=1.05;audio.setActive(false);
 for(const source of voices.slice(0,-1))assert.ok(source.stopAt<=1.075,'cancelled world action can sound again after a quick resume');
 assert.equal(menu.stopAt,menuEnd,'pause must preserve menu confirmations');
 const ends=voices.map(s=>s.stopAt);ctx.currentTime=1.06;audio.setActive(false);assert.deepEqual(voices.map(s=>s.stopAt),ends,'repeated panels must not extend cancelled tails');
 audio.setActive(true);for(const source of voices)source.onended();assert.equal(audio.sources.size,0);assert.equal(audio.effectReleases.size,0);for(const source of voices)assert(source.disconnected);
});
test('mute cancels world and menu tails so a quick unmute does not revive old cues',()=>{
 const {audio,ctx}=rig();audio.effect('enemy-windup');audio.effect('craft',{menu:true});const voices=[...audio.sources];ctx.currentTime=1.04;audio.setEnabled(false);
 for(const source of voices)assert.ok(source.stopAt<=1.065,'muted transient outlives its short release');
 audio.setEnabled(true);for(const source of voices)source.onended();assert.equal(audio.sources.size,0);
 audio.effect('enemy-windup');assert.equal(audio.sources.size,1,'a new warning must still play after interruption');
});
