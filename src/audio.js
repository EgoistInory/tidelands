// Local synthesis: no downloads, microphone access or external audio service.
export class GameAudio{
  constructor({enabled=true,contextFactory=()=>new AudioContext()}={}){this.enabled=enabled;this.contextFactory=contextFactory;this.context=null;this.active=false;this.sources=new Set();this.stepDistance=0;this.lastPosition=null;}
  async unlock(){
    if(!this.enabled)return;
    try{
    if(!this.context){
      const ctx=this.contextFactory();this.context=ctx;
      this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
      this.ui=ctx.createGain();this.ui.gain.value=0;this.ui.connect(ctx.destination);
      this.noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const samples=this.noise.getChannelData(0);let brown=0;
      for(let i=0;i<samples.length;i++){brown=(brown+(Math.random()*2-1)*.035)/1.025;samples[i]=brown;}
      // Match the loop endpoints and remove DC, avoiding a click every three seconds.
      const drift=samples[samples.length-1]-samples[0];let mean=0;
      for(let i=0;i<samples.length;i++){samples[i]-=drift*i/(samples.length-1);mean+=samples[i];}
      mean/=samples.length;for(let i=0;i<samples.length;i++)samples[i]-=mean;
      this.ambience=ctx.createBufferSource();this.ambience.buffer=this.noise;this.ambience.loop=true;
      this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=650;
      this.wind=ctx.createGain();this.wind.gain.value=.1;this.ambience.connect(this.filter);this.filter.connect(this.wind);this.wind.connect(this.master);this.ambience.start();
      // A second, offset noise layer washes in and recedes near the shore.
      this.surfSource=ctx.createBufferSource();this.surfSource.buffer=this.noise;this.surfSource.loop=true;
      this.surfFilter=ctx.createBiquadFilter();this.surfFilter.type='bandpass';this.surfFilter.frequency.value=560;this.surfFilter.Q.value=.55;
      this.surf=ctx.createGain();this.surf.gain.value=0;
      this.surfSource.connect(this.surfFilter);this.surfFilter.connect(this.surf);this.surf.connect(this.master);this.surfSource.start(0,1.173);
    }
    await this.context.resume();this.applyVolume();
    }catch(error){await this.dispose();throw error;}
  }
  applyVolume(){if(this.context){this.master.gain.setTargetAtTime(this.enabled&&this.active?.35:0,this.context.currentTime,.08);this.ui.gain.setTargetAtTime(this.enabled?.35:0,this.context.currentTime,.02);}}
  setActive(active){this.active=active;this.applyVolume();if(!active){this.lastPosition=null;this.lastFootfallCount=null;this.stepDistance=0;}}
  setEnabled(enabled){this.enabled=enabled;this.applyVolume();}
  effect(kind,{menu=false,surface='grass'}={}){
    const ui=menu&&['craft','food'].includes(kind);
    const tone=['quest','craft','food'].includes(kind),ctx=this.context;
    // Keep three slots available for success cues during crowded physical actions.
    if(!ctx||ctx.state!=='running'||!this.enabled||(!this.active&&!ui)||this.sources.size>=12||(!tone&&this.sources.size>=9))return;
    const node=tone?ctx.createOscillator():ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),now=ctx.currentTime;
    const sandy=kind==='step'&&surface==='sand';
    const length=kind==='quest'?.65:kind==='swing'?.16:kind==='step'?(sandy?.13:.09):.22;
    if(tone){node.type='sine';node.frequency.setValueAtTime(kind==='quest'?440:kind==='craft'?660:330,now);node.frequency.exponentialRampToValueAtTime(kind==='quest'?880:440,now+length);}else node.buffer=this.noise;
    filter.type=tone?'lowpass':'bandpass';filter.frequency.value=tone?2800:kind==='splash'?1200:kind==='swing'?1600:kind==='hit'?260:kind==='gather'?700:sandy?520:140;filter.Q.value=.7;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(kind==='step'?.16:tone?.13:.45,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+length);
    node.connect(filter);filter.connect(gain);gain.connect(ui?this.ui:this.master);this.sources.add(node);
    node.onended=()=>{node.disconnect();filter.disconnect();gain.disconnect();this.sources.delete(node);};
    if(tone)node.start(now);
    else{
      // Read a different section of the shared noise for successive physical actions.
      this.noisePhase=((this.noisePhase??0)+.38196601125)%1;
      const offset=this.noisePhase*Math.max(0,this.noise.duration-length-.02);
      node.start(now,offset);
    }
    node.stop(now+length+.02);
  }
  update(player,time,height,footfallCount=null){
    if(!this.active)return;
    if(this.context){const now=this.context.currentTime;this.wind.gain.setTargetAtTime((height<2?.18:.075)*(1+Math.sin(time*.3)*.25),now,.3);this.filter.frequency.setTargetAtTime(height<2?850:420,now,.3);
      const shore=Math.max(0,Math.min(1,(5-height)/5)),wave=.5+.5*Math.sin(time*.65);
      this.surf.gain.setTargetAtTime(shore*(.035+.10*wave*wave),now,.45);this.surfFilter.frequency.setTargetAtTime(460+220*wave,now,.4);
    }
    const priorFootfalls=this.lastFootfallCount??null;this.lastFootfallCount=Number.isSafeInteger(footfallCount)&&footfallCount>=0?footfallCount:null;
    const last=this.lastPosition;this.lastPosition={x:player.x,z:player.z};if(!last)return;
    const distance=Math.hypot(player.x-last.x,player.z-last.z);if(distance>4){this.stepDistance=0;return;}
    // The rendered rig owns land contacts, including running flight and idle recovery.
    if(height>=0&&this.lastFootfallCount!==null){
      this.stepDistance=0;
      if(priorFootfalls!==null)for(let i=0;i<Math.min(2,Math.max(0,this.lastFootfallCount-priorFootfalls));i++)this.effect('step',{surface:height<2?'sand':'grass'});
      return;
    }
    const stride=height<0?1.7:.8;
    this.stepDistance+=distance;if(this.stepDistance>=stride){this.stepDistance%=stride;this.effect(height<0?'splash':'step',{surface:height<2?'sand':'grass'});}
  }
  async dispose(){
    const ctx=this.context;this.context=null;
    for(const source of this.sources){try{source.stop();}catch{}source.disconnect();}
    this.sources.clear();
    if(this.ambience){try{this.ambience.stop();}catch{}this.ambience.disconnect();}
    if(this.surfSource){try{this.surfSource.stop();}catch{}this.surfSource.disconnect();}
    for(const node of [this.filter,this.wind,this.surfFilter,this.surf,this.master,this.ui])node?.disconnect();
    this.ambience=this.filter=this.wind=this.surfSource=this.surfFilter=this.surf=this.master=this.ui=this.noise=null;
    this.lastPosition=null;this.lastFootfallCount=null;this.stepDistance=0;
    if(ctx&&ctx.state!=='closed'){try{await ctx.close();}catch{}}
  }
}
