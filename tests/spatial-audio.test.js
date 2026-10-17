import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as audio from '../src/audio.js';

test('enemy sound direction follows screen right and distance fades continuously',()=>{
  assert.equal(typeof audio.enemySoundCue,'function');const p={x:0,z:0},cue=audio.enemySoundCue;
  assert.ok(cue(p,{x:3,z:0},0).pan>0);assert.ok(cue(p,{x:-3,z:0},0).pan<0);
  assert.ok(cue(p,{x:0,z:-3},Math.PI/2).pan>0);
  assert.equal(cue(p,p,0).pan,0);assert.equal(cue(p,p,0).volume,1);
  assert.ok(cue(p,{x:12,z:0},0).volume<cue(p,{x:3,z:0},0).volume);
  assert.equal(cue(p,{x:24,z:0},0).volume,0);assert.equal(cue(p,null,0).volume,0);
  for(let d=0;d<25;d+=.01){const a=cue(p,{x:d,z:0},0),b=cue(p,{x:d+.01,z:0},0);assert.ok(Math.abs(a.volume-b.volume)<.01);assert.ok(Number.isFinite(a.pan)&&Math.abs(a.pan)<=.85);}
});

test('spatial effect routes and releases one bounded panner; muted cues allocate none',()=>{
  const param=()=>({value:0,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.peak=v;},exponentialRampToValueAtTime(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),connect(t){this.target=t;},disconnect(){this.disconnected=true;},start(){},stop(){}});
  let made=0,panner;const ctx={state:'running',currentTime:1,createGain:node,createBufferSource:node,createBiquadFilter:node,createStereoPanner(){made++;panner={...node(),pan:param()};return panner;}};
  const a=new audio.GameAudio();Object.assign(a,{context:ctx,master:node(),ui:node(),noise:{duration:3},active:true});
  a.effect('enemy-windup',{pan:.7,volume:.5});assert.equal(made,1);assert.equal(panner.pan.value,.7);
  const source=[...a.sources][0],gain=source.target.target;assert.equal(gain.target,panner);assert.equal(panner.target,a.master);assert.equal(gain.gain.peak,.11);
  source.onended();assert.equal(a.sources.size,0);assert.ok(panner.disconnected);
  a.effect('enemy-windup',{volume:0});assert.equal(made,1);a.enabled=false;a.effect('enemy-windup',{pan:1});assert.equal(made,1);
});
