// Local synthesis: no downloads, microphone access or external audio service.
import {ISLANDS,dayCycle,randomGenerator,weatherAt} from './world.js';
const habitatDensity=[.6,1,.24,.48];
export function enemySoundCue(player,enemy,cameraYaw=0){
  if(!player||!enemy||![player.x,player.z,enemy.x,enemy.z,cameraYaw].every(Number.isFinite))return {pan:0,volume:0};
  const x=enemy.x-player.x,z=enemy.z-player.z,distance=Math.hypot(x,z);
  // Camera looks toward the player from +yaw; its screen-right axis is (cos(yaw),-sin(yaw)).
  const pan=distance<1e-6?0:.85*(x*Math.cos(cameraYaw)-z*Math.sin(cameraYaw))/distance;
  const fade=Math.max(0,Math.min(1,(24-distance)/8)),volume=fade/(1+(Math.max(0,distance-2)/7)**2);
  return {pan:Math.max(-.85,Math.min(.85,pan)),volume};
}
function ecologyBuffer(ctx,kind){
  const bird=kind==='birds',seconds=bird?23:19,random=randomGenerator(bird?9971:8831);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*seconds,ctx.sampleRate),samples=buffer.getChannelData(0);
  // Sparse phrases leave quiet loop boundaries; pitch, spacing and envelopes vary per phrase.
  for(let phrase=0;phrase<(bird?8:22);phrase++){
    const start=(bird?.8:.4)+phrase*(bird?2.65:.78)+random()*(bird?.7:.14),frequency=(bird?1800:3100)+random()*(bird?1600:1300);
    const notes=bird?2+Math.floor(random()*3):4+Math.floor(random()*4);
    for(let note=0;note<notes;note++){
      const duration=bird?.08+random()*.09:.025+random()*.025,offset=Math.round((start+note*(bird?.18:.065))*ctx.sampleRate),length=Math.round(duration*ctx.sampleRate);let phase=0;
      for(let i=0;i<length&&offset+i<samples.length;i++){
        const t=i/ctx.sampleRate,u=i/Math.max(1,length-1),envelope=Math.sin(Math.PI*u)**2;
        phase+=2*Math.PI*frequency*(bird?1+.22*Math.sin(t*24)+.15*u:1+.025*Math.sin(t*190))/ctx.sampleRate;
        samples[offset+i]+=(bird?.42:.22)*envelope*(Math.sin(phase)+.12*Math.sin(phase*2));
      }
    }
  }
  return buffer;
}
function fireBuffer(ctx){
  const seconds=4,buffer=ctx.createBuffer(1,ctx.sampleRate*seconds,ctx.sampleRate),data=buffer.getChannelData(0),random=randomGenerator(4147);let low=0;
  for(let i=0;i<data.length;i++){low=low*.94+(random()*2-1)*.018;data[i]=low;}
  for(let pop=0;pop<32;pop++){
    const start=Math.floor((.08+pop*.118+random()*.035)*ctx.sampleRate),length=Math.max(2,Math.floor((.008+random()*.035)*ctx.sampleRate)),level=.15+random()*.45;
    for(let i=0;i<length&&start+i<data.length;i++)data[start+i]+=(random()*2-1)*level*Math.sin(Math.PI*i/(length-1))**2;
  }
  const fade=Math.max(1,Math.floor(ctx.sampleRate*.025));
  for(let i=0;i<fade;i++){data[i]*=i/fade;data[data.length-1-i]*=i/fade;}
  return buffer;
}
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
      for(const kind of ['birds','insects']){
        const source=ctx.createBufferSource();this[kind+'Source']=source;source.buffer=ecologyBuffer(ctx,kind);source.loop=true;
        const gain=ctx.createGain();this[kind]=gain;gain.gain.value=0;source.connect(gain);gain.connect(this.master);source.start();
      }
      this.fireSource=ctx.createBufferSource();this.fireSource.buffer=fireBuffer(ctx);this.fireSource.loop=true;
      this.fireFilter=ctx.createBiquadFilter();this.fireFilter.type='lowpass';this.fireFilter.frequency.value=2600;
      this.fire=ctx.createGain();this.fire.gain.value=0;this.firePan=ctx.createStereoPanner?.()??null;
      this.fireSource.connect(this.fireFilter);this.fireFilter.connect(this.fire);
      if(this.firePan){this.fire.connect(this.firePan);this.firePan.connect(this.master);}else this.fire.connect(this.master);
      this.fireSource.start();
    }
    await this.context.resume();this.applyVolume();
    }catch(error){await this.dispose();throw error;}
  }
  applyVolume(){if(this.context){this.master.gain.setTargetAtTime(this.enabled&&this.active?.35:0,this.context.currentTime,.08);this.ui.gain.setTargetAtTime(this.enabled?.35:0,this.context.currentTime,.02);}}
  setActive(active){this.active=active;this.applyVolume();if(!active){this.lastPosition=null;this.lastFootfallCount=null;this.stepDistance=0;}}
  setEnabled(enabled){this.enabled=enabled;this.applyVolume();}
  effect(kind,{menu=false,surface='grass',enemyType='boar',weapon='hand',pan=0,volume=1}={}){
    const ui=menu&&['craft','food'].includes(kind);
    const tone=['quest','craft','food'].includes(kind),ctx=this.context;
    const level=tone?1:Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0;
    // Keep three slots available for success cues during crowded physical actions.
    if(!level||!ctx||ctx.state!=='running'||!this.enabled||(!this.active&&!ui)||this.sources.size>=12||(!tone&&this.sources.size>=9))return;
    const node=tone?ctx.createOscillator():ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),now=ctx.currentTime;
    const sandy=kind==='step'&&surface==='sand',windup=kind==='enemy-windup';
    let length=windup?.3:kind==='quest'?.65:kind==='swing'?.16:kind==='step'?(sandy?.13:.09):.22;
    let frequency=windup?(enemyType==='crab'?720:180):tone?2800:kind==='splash'?1200:kind==='swing'?1600:kind==='hit'?260:kind==='gather'?700:sandy?520:140;
    let peak=windup?.22:kind==='step'?.16:tone?.13:.45;
    // Use the confirmed material/action identity without adding voices or buffers.
    if(kind==='gather'){
      if(surface==='tree'){frequency=340;length=.22;}
      else if(surface==='stone'||surface==='crystal'){frequency=surface==='crystal'?2400:1600;length=.17;}
      else if(['berry','fiber','shell'].includes(surface)){frequency=surface==='shell'?1900:950;length=.10;peak=.24;}
    }else if(kind==='swing'){frequency=weapon==='sword'?2100:weapon==='axe'?1050:650;}
    else if(kind==='hit'&&enemyType==='crab'){frequency=1100;length=.12;peak=.42;}
    else if(kind==='hurt'){frequency=95;length=.34;peak=.50;}
    if(tone){node.type='sine';node.frequency.setValueAtTime(kind==='quest'?440:kind==='craft'?660:330,now);node.frequency.exponentialRampToValueAtTime(kind==='quest'?880:440,now+length);}else node.buffer=this.noise;
    filter.type=tone?'lowpass':'bandpass';filter.frequency.value=frequency;filter.Q.value=.7;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(peak*level,now+(windup?.04:.008));gain.gain.exponentialRampToValueAtTime(.0001,now+length);
    const spatial=!tone&&(windup||pan!==0)&&Number.isFinite(pan)&&ctx.createStereoPanner?ctx.createStereoPanner():null;
    node.connect(filter);filter.connect(gain);
    if(spatial){spatial.pan.setValueAtTime(Math.max(-.85,Math.min(.85,pan)),now);gain.connect(spatial);spatial.connect(this.master);}else gain.connect(ui?this.ui:this.master);
    this.sources.add(node);
    node.onended=()=>{node.disconnect();filter.disconnect();gain.disconnect();spatial?.disconnect();this.sources.delete(node);};
    if(tone)node.start(now);
    else{
      // Read a different section of the shared noise for successive physical actions.
      this.noisePhase=((this.noisePhase??0)+.38196601125)%1;
      const offset=this.noisePhase*Math.max(0,this.noise.duration-length-.02);
      node.start(now,offset);
    }
    node.stop(now+length+.02);
  }
  update(player,time,height,footfallCount=null,{buildings=[],cameraYaw=0}={}){
    if(!this.active)return;
    if(this.context){const now=this.context.currentTime,{windStrength}=weatherAt(time);this.wind.gain.setTargetAtTime((height<2?.18:.075)*(1+Math.sin(time*.3)*.25)*windStrength,now,.3);this.filter.frequency.setTargetAtTime(height<2?850:420,now,.3);
      const shore=Math.max(0,Math.min(1,(5-height)/5)),wave=.5+.5*Math.sin(time*.65);
      this.surf.gain.setTargetAtTime(shore*(.035+.10*wave*wave)*windStrength,now,.45);this.surfFilter.frequency.setTargetAtTime(460+220*wave,now,.4);
      let habitat=0;
      for(let i=0;i<ISLANDS.length;i++){const island=ISLANDS[i],inside=Math.max(0,Math.min(1,(1-Math.hypot(player.x-island.x,player.z-island.z)/island.r)/.32));habitat=Math.max(habitat,inside*habitatDensity[i]);}
      habitat*=Math.max(0,Math.min(1,height/6));
      const day=Math.max(0,Math.min(1,(dayCycle(time).daylight-.08)/.5));
      this.birds.gain.setTargetAtTime(habitat*day*.18,now,1.8);
      this.insects.gain.setTargetAtTime(habitat*(1-day)*.09,now,1.8);
      // One nearest-fire bed keeps large saved camps within a fixed audio budget.
      let fire=null,distance=24;for(const b of buildings){if(b.type!=='campfire'||!Number.isFinite(b.x)||!Number.isFinite(b.z))continue;const d=Math.hypot(b.x-player.x,b.z-player.z);if(d<distance){distance=d;fire=b;}}
      const cue=enemySoundCue(player,fire,cameraYaw);
      this.fire.gain.setTargetAtTime(cue.volume*.18,now,.25);this.firePan?.pan.setTargetAtTime(cue.pan,now,.12);
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
    if(this.fireSource){try{this.fireSource.stop();}catch{}this.fireSource.disconnect();}
    for(const source of [this.birdsSource,this.insectsSource])if(source){try{source.stop();}catch{}source.disconnect();}
    for(const node of [this.filter,this.wind,this.surfFilter,this.surf,this.birds,this.insects,this.fireFilter,this.fire,this.firePan,this.master,this.ui])node?.disconnect();
    this.ambience=this.filter=this.wind=this.surfSource=this.surfFilter=this.surf=this.birdsSource=this.insectsSource=this.birds=this.insects=this.master=this.ui=this.noise=null;
    this.fireSource=this.fireFilter=this.fire=this.firePan=null;
    this.lastPosition=null;this.lastFootfallCount=null;this.stepDistance=0;
    if(ctx&&ctx.state!=='closed'){try{await ctx.close();}catch{}}
  }
}
