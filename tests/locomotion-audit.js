// Offline quality diagnostic. Numerical contact results are not visual acceptance.
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

function sample({kind,fps=60,speed=7,slope=0}){
  const root=createCharacter(),dt=1/fps,prior=[null,null],ground=(x,z)=>slope*(x*.75+z),normalY=1/Math.sqrt(1+slope*slope*1.5625);let x=0,z=0,maxFrameDrift=0,maxStanceTravel=0,maxSoleError=0,maxFootStep=0,minPelvisHeight=0,contacts=0,worstSole=null,worstFootStep=null,startPhase=0,bothFeetAirborneFrames=0;
  animateCharacter(root,{x,z,yaw:0,time:0,attackAt:-100,selected:'hand'},dt,ground);
  for(let frame=1;frame<=fps*4;frame++){
    const time=frame*dt,turn=(kind==='turn'||kind==='reverse')&&time>=2,stopped=kind==='stop'&&time>2||kind==='restart'&&time>1&&time<2,yaw=turn?(kind==='reverse'?Math.PI:Math.PI/2):kind==='circle'?time*.6:0;
    const distance=kind==='burst'?(frame<fps?speed*dt:frame<fps+6?.84:0):stopped?0:speed*dt;
    x+=Math.sin(yaw)*distance;z+=Math.cos(yaw)*distance;
    root.position.set(x,ground(x,z),z);animateCharacter(root,{x,z,yaw,time,attackAt:-100,selected:'hand'},dt,ground);root.updateMatrixWorld(true);
    if(frame===fps*2)startPhase=root.userData.phase;
    if(distance>0&&root.userData.footContacts.every(contact=>!contact))bothFeetAirborneFrames++;
    minPelvisHeight=Math.min(minPelvisHeight,root.userData.body.position.y);
    for(let side=0;side<2;side++){
      const cycle=(root.userData.phase+side*Math.PI)/(2*Math.PI),stance=root.userData.footContacts[side],point=root.userData.ankles[side].getWorldPosition(new THREE.Vector3()),last=prior[side];
      let travel=0;
      if(last&&point.distanceTo(last.point)>maxFootStep){maxFootStep=point.distanceTo(last.point);worstFootStep={frame,side,position:point.toArray(),priorPosition:last.point.toArray(),phase:root.userData.phase,contact:stance};}
      if(stance){const error=Math.abs((point.y-ground(point.x,point.z))*normalY-.145);if(error>maxSoleError){maxSoleError=error;worstSole={frame,side,position:point.toArray(),phase:root.userData.phase};}}
      if(time>1&&stance&&last?.stance&&last.cycle===Math.floor(cycle)){
        const drift=point.distanceTo(last.point);travel=last.travel+drift;
        maxFrameDrift=Math.max(maxFrameDrift,drift);maxStanceTravel=Math.max(maxStanceTravel,travel);contacts++;
      }
      prior[side]={cycle:Math.floor(cycle),stance,point,travel};
    }
  }
  return {kind,fps,speedMetersPerSecond:speed,slope,contacts,maxFrameDriftMeters:maxFrameDrift,maxWithinStanceTravelMeters:maxStanceTravel,maxSoleHeightErrorMeters:maxSoleError,maxFrameFootTravelMeters:maxFootStep,minPelvisOffsetMeters:minPelvisHeight,strideLengthMeters:root.userData.strideLength,stanceFraction:root.userData.stanceFraction,phaseCyclesPerSecondLast2Seconds:(root.userData.phase-startPhase)/(2*Math.PI)/2,bothFeetAirborneFrames,worstSole,worstFootStep};
}
const cases=['straight','turn','stop','reverse','restart','circle','burst'].map(kind=>({kind}));
for(const fps of [30,60,144])for(const speed of [2.4,7,12])cases.push({kind:'turn',fps,speed,slope:.04});
console.log(JSON.stringify({status:'known_quality_gaps',characterSha256:createHash('sha256').update(readFileSync(new URL('../src/character.js',import.meta.url))).digest('hex'),cases:cases.map(sample),limitations:['Offline rig audit on analytic flat and gently sloped floors','Abrupt 90/180 degree input after two seconds; stop, restart and curved travel','Contact comes from the production planner including early release of overextended steps; swing movement is reported separately','No motion video, GPU measurement, irregular terrain or complete gameplay acceptance']},null,2));
