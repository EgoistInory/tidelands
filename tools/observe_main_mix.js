// Appended to the served audio module only. Fan-out capture preserves both native outputs.
const mixUnlock=GameAudio.prototype.unlock,mixEffect=GameAudio.prototype.effect;
let mixEngine=null,mixRecorder=null,mixDestination=null,mixStart=0,mixPending=0,mixPeak=0,mixBytes=0,mixChunks=0,mixRecording=false;
const mixEvents=[],mixErrors=[];
GameAudio.prototype.unlock=async function(...args){const result=await mixUnlock.apply(this,args);mixEngine=this;return result;};
GameAudio.prototype.effect=function(kind,options){const before=this.sources.size,result=mixEffect.call(this,kind,options);if(mixRecording){if(mixEvents.length>=6000)throw Error('Bounded audio event log full');mixEvents.push({method:'effect',kind,options,at:this.context.currentTime-mixStart,before,after:this.sources.size,active:this.active,enabled:this.enabled});}return result;};
for(const name of ['setActive','setEnabled']){const original=GameAudio.prototype[name];GameAudio.prototype[name]=function(value){const result=original.call(this,value);if(mixRecording)mixEvents.push({method:name,value,at:this.context.currentTime-mixStart,sources:this.sources.size});return result;};}
window.mainMix={
 status(){return {context:mixEngine?.context?.state,active:mixEngine?.active,enabled:mixEngine?.enabled,recording:mixRecording,seconds:mixEngine?.context?mixEngine.context.currentTime-mixStart:0,bytes:mixBytes,chunks:mixChunks,pending:mixPending,peakPending:mixPeak,errors:mixErrors,events:mixEvents,sources:mixEngine?.sources.size};},
 start(){
  if(mixRecording||!mixEngine?.context||mixEngine.context.state!=='running')throw Error('Native audio must be unlocked before recording');
  const mimeType='audio/webm;codecs=opus';if(!MediaRecorder.isTypeSupported(mimeType))throw Error('Native Opus recorder unavailable');
  mixDestination=mixEngine.context.createMediaStreamDestination();mixEngine.master.connect(mixDestination);mixEngine.ui.connect(mixDestination);
  mixRecorder=new MediaRecorder(mixDestination.stream,{mimeType,audioBitsPerSecond:128000});
  mixRecorder.ondataavailable=event=>{if(!event.data.size)return;mixPending++;mixPeak=Math.max(mixPeak,mixPending);if(mixPending>4){mixPending--;mixErrors.push('Recorder backpressure: chunk rejected');return;}
   event.data.arrayBuffer().then(b=>{mixBytes+=b.byteLength;mixChunks++;return window.__mainMixSink(Array.from(new Uint8Array(b)));}).catch(e=>mixErrors.push(String(e))).finally(()=>mixPending--);
  };
  mixStart=mixEngine.context.currentTime;mixRecording=true;mixRecorder.start(1000);return {mimeType,sampleRate:mixEngine.context.sampleRate,channels:mixDestination.channelCount,startContextTime:mixStart};
 },
 async stop(){
  if(!mixRecording)throw Error('Recorder not running');
  await new Promise(resolve=>{mixRecorder.onstop=resolve;mixRecorder.stop();});while(mixPending)await new Promise(r=>setTimeout(r,10));mixRecording=false;
  mixEngine.master.disconnect(mixDestination);mixEngine.ui.disconnect(mixDestination);for(const track of mixDestination.stream.getTracks())track.stop();return this.status();
 }
};
