// Decode retained recordings without resampling; preserve browser Float32 PCM in WAV.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'docs/main-mix-2026-11-05');
const sha=b=>createHash('sha256').update(b).digest('hex');
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const browser=await chromium.launch({channel:'chromium',headless:true});
const results=[];
try{
 const page=await browser.newPage();
 for(const mode of ['camp','combat']){
  const source=path.join(dir,`${mode}-main-mix.webm`),out=path.join(dir,`${mode}-full-48k-float.wav`);
  const input=fs.readFileSync(source),originalSha=sha(input);
  const result=await page.evaluate(async base64=>{
   const bytes=Uint8Array.from(atob(base64),x=>x.charCodeAt(0));
   const ctx=new OfflineAudioContext(2,1,48000);
   const pcm=await ctx.decodeAudioData(bytes.buffer);
   if(pcm.sampleRate!==48000||pcm.numberOfChannels!==2)throw Error('Unexpected decoded format');
   const data=new ArrayBuffer(44+pcm.length*8),v=new DataView(data);
   const str=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
   str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');
   v.setUint32(16,16,true);v.setUint16(20,3,true);v.setUint16(22,2,true);
   v.setUint32(24,48000,true);v.setUint32(28,48000*8,true);v.setUint16(32,8,true);v.setUint16(34,32,true);
   str(36,'data');v.setUint32(40,pcm.length*8,true);
   for(let c=0;c<2;c++){const channel=pcm.getChannelData(c);for(let i=0;i<pcm.length;i++){
    if(!Number.isFinite(channel[i]))throw Error('Nonfinite PCM');v.setFloat32(44+i*8+c*4,channel[i],true);
   }}
   const decoded=await ctx.decodeAudioData(data.slice(0));let mismatches=0;
   if(decoded.length!==pcm.length)throw Error('Length changed');
   for(let c=0;c<2;c++)for(let i=0;i<pcm.length;i++)if(decoded.getChannelData(c)[i]!==pcm.getChannelData(c)[i])mismatches++;
   let binary='';const u=new Uint8Array(data);for(let i=0;i<u.length;i+=16384)binary+=String.fromCharCode(...u.subarray(i,i+16384));
   return {base64:btoa(binary),frames:pcm.length,seconds:pcm.duration,mismatches};
  },input.toString('base64'));
  assert.equal(result.mismatches,0);
  const output=Buffer.from(result.base64,'base64');
  if(fs.existsSync(out))assert.equal(sha(fs.readFileSync(out)),sha(output),'Existing output differs; refuse overwrite');
  else fs.writeFileSync(out,output,{flag:'wx'});delete result.base64;
  await page.goto(pathToFileURL(path.join(dir,'review.html')).href);
  await page.evaluate(src=>{document.body.replaceChildren();const a=document.createElement('audio');a.controls=true;a.preload='auto';a.src=src;document.body.append(a);},pathToFileURL(out).href);
  await page.waitForFunction(()=>document.querySelector('audio')?.readyState>=1);
  const seeks=[];
  for(const target of [1,15,result.seconds-1]){
   await page.evaluate(t=>{document.querySelector('audio').currentTime=t;},target);
   await page.waitForFunction(t=>{const a=document.querySelector('audio');return !a.seeking&&Math.abs(a.currentTime-t)<.05;},target);
   seeks.push(await page.evaluate(()=>{const a=document.querySelector('audio');return {time:a.currentTime,duration:a.duration,error:a.error?.code??null};}));
  }
  assert(seeks.every(s=>!s.error&&Math.abs(s.duration-result.seconds)<.001));
  assert.equal(sha(fs.readFileSync(source)),originalSha);
  results.push({mode,originalSha,output:path.basename(out),sha256:sha(fs.readFileSync(out)),...result,seeks});
 }
 fs.writeFileSync(path.join(dir,'seekable-audit.json'),JSON.stringify({scope:'Exact Float32 decoded PCM roundtrip and native media seeks; no audition or AV sync claim',results},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(results));
}finally{await browser.close();}
