import {ATTACK_DURATION,GATHER_DURATION} from './action-timing.js';

// Displacement per complete source RM cycle, measured from the fixed CC0 Standard archive.
// These drive the in-place clips; gameplay remains the only owner of world movement.
export const AUTHORED_STRIDES=Object.freeze({Walk_Loop:1.2999999523162842,Jog_Fwd_Loop:5,Sprint_Loop:5.5,Swim_Fwd_Loop:2.9000000953674316});
export function createAuthoredPoseClock(scale=1){
  if(!Number.isFinite(scale)||scale<=0)throw Error('Positive author display scale required');
  let previous=null,cycles=0;
  return {update(state,dt){
    const {x,z,time,swimming=false,selected='hand',attackAt=-100,gatherAt=-100,gatherKind=null,gatherTool=null,hurtAt=-100}=state;
    const distance=previous?Math.hypot(x-previous.x,z-previous.z):0,advancing=Number.isFinite(dt)&&dt>0;
    const resetContacts=!previous||distance>5||time<previous.time||swimming!==previous.swimming||(!advancing&&distance>.0001);
    if(resetContacts)cycles=0;
    const traveled=advancing&&!resetContacts?distance:0,speed=traveled/(advancing?dt:1),moving=traveled>.0001;
    const baseClip=swimming?(moving?'Swim_Fwd_Loop':'Swim_Idle_Loop'):!moving?'Idle_Loop':speed>9?'Sprint_Loop':speed>3?'Jog_Fwd_Loop':'Walk_Loop';
    if(moving)cycles+=traveled/(AUTHORED_STRIDES[baseClip]*scale);
    let action=null,actionProgress=0,equipped=selected;
    if(time>=attackAt&&time<attackAt+ATTACK_DURATION){action='attack';actionProgress=(time-attackAt)/ATTACK_DURATION;}
    else if(!swimming&&time>=gatherAt&&time<gatherAt+GATHER_DURATION){
      action='gather';actionProgress=(time-gatherAt)/GATHER_DURATION;
      equipped=['berry','fiber','shell'].includes(gatherKind)?'hand':(gatherTool??selected);
    }
    const recoil=time>=hurtAt&&time<hurtAt+.3?1-(time-hurtAt)/.3:0;
    previous={x,z,time,swimming};
    return {baseClip,cycles,phase:cycles%1,speed,action,actionProgress,equipped,recoil,resetContacts};
  }};
}
