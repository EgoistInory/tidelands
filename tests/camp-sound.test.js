import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio} from '../src/audio.js';

function context(stereo=true){
  const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),pan:param(),connect(to){this.to=to;},disconnect(){this.disconnected=true;},start(){},stop(){this.stopped=true;}});
  let sources=0,buffers=0;
  return {state:'running',sampleRate:100,currentTime:1,destination:node(),createGain:node,createBiquadFilter:node,
    ...(stereo?{createStereoPanner:node}:{}),createBufferSource(){sources++;return node();},
    createBuffer(_,n,rate){buffers++;const samples=new Float32Array(n);return {duration:n/rate,getChannelData:()=>samples};},
    async resume(){},async close(){this.state='closed';},counts(){return {sources,buffers};}};
}
const fire={id:'camp',type:'campfire',x:2,z:0};
test('an audible camp follows the nearest real fire and camera direction without per-building allocations',async()=>{
  const ctx=context(),a=new GameAudio({contextFactory:()=>ctx});a.setActive(true);await a.unlock();
  assert.ok(a.fireSource&&a.fire,'a visible burning camp currently has no environmental sound');
  assert.equal(a.fire.gain.value,0);const counts=ctx.counts(),source=a.fireSource,buffer=source.buffer;
  assert.ok(source.loop&&buffer.duration<=8);assert.ok(buffer.getChannelData(0).every(Number.isFinite));
  a.update({x:0,z:0},10,5,0,{buildings:[fire],cameraYaw:0});const near=a.fire.gain.value;assert.ok(near>0&&a.firePan.pan.value>0);
  a.update({x:0,z:0},10,5,0,{buildings:[fire],cameraYaw:Math.PI});assert.ok(a.firePan.pan.value<0);
  a.update({x:-12,z:0},10,5,0,{buildings:[fire]});assert.ok(a.fire.gain.value>0&&a.fire.gain.value<near);
  for(let i=0;i<300;i++)a.update({x:0,z:0},10,5,0,{buildings:Array.from({length:100},(_,i)=>({...fire,id:String(i),x:i+2}))});
  assert.deepEqual(ctx.counts(),counts);assert.equal(a.fireSource,source);assert.equal(a.sources.size,0);
  for(const buildings of [[],[{...fire,type:'tent'}],[{...fire,x:Infinity}],[{...fire,x:30}]]){a.update({x:0,z:0},10,5,0,{buildings});assert.equal(a.fire.gain.value,0);}
  await a.dispose();
});
test('camp ambience respects pause/mute and releases its whole graph with a centered fallback',async()=>{
  for(const stereo of [true,false]){
    const ctx=context(stereo),a=new GameAudio({contextFactory:()=>ctx});a.setActive(true);await a.unlock();
    assert.ok(a.fireSource);a.update({x:0,z:0},0,5,0,{buildings:[fire]});
    const nodes=[a.fireSource,a.fireFilter,a.fire,...(stereo?[a.firePan]:[])];
    a.setActive(false);assert.equal(a.master.gain.value,0);a.setActive(true);a.setEnabled(false);assert.equal(a.master.gain.value,0);
    await a.dispose();assert.ok(nodes.every(n=>n.disconnected));assert.ok(nodes[0].stopped);assert.equal(a.fireSource,null);assert.equal(a.fire,null);
  }
});
test('a failed fire panner initialization releases the partially built graph and retries cleanly',async()=>{
  const broken=context(),create=broken.createBufferSource;let last;
  broken.createBufferSource=()=>last=create();broken.createStereoPanner=()=>{throw Error('fire panner unavailable');};
  let attempts=0;const a=new GameAudio({contextFactory:()=>attempts++===0?broken:context()});a.setActive(true);
  await assert.rejects(a.unlock(),/fire panner unavailable/);assert.equal(broken.state,'closed');assert.ok(last.stopped&&last.disconnected);
  assert.equal(a.context,null);assert.equal(a.fireSource,null);await a.unlock();assert.ok(a.fireSource);await a.dispose();
});
