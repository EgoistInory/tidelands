import * as THREE from '../vendor/three.module.min.js';
import {dressAuthoredAvatar,attachAuthorHair} from './authored-wardrobe.js';
import {captureAuthorRest,retargetAuthoredClips} from './authored-retarget.js';
import {createAuthoredPoseClock} from './authored-pose-clock.js';
import {createCharacterTools} from './character.js';
const up=new THREE.Vector3(0,1,0);
const upper=name=>!['root','pelvis'].includes(name)&&! /^(thigh|calf|foot|ball)_/.test(name);
function compiled(clip,root){return {duration:clip.duration,tracks:clip.tracks.map(t=>{const split=t.name.lastIndexOf('.'),name=t.name.slice(0,split);return {bone:root.getObjectByName(name),name,property:t.name.slice(split+1),sample:t.createInterpolant()};})};}
function sample(clip,time,onlyUpper=false,weight=1){
  for(const t of clip.tracks){if(onlyUpper&&!upper(t.name))continue;const v=t.sample.evaluate(Math.min(clip.duration,Math.max(0,time))),property=t.bone[t.property];
    if(weight===1)property.fromArray(v);else if(t.property==='quaternion')property.slerp(new THREE.Quaternion().fromArray(v),weight);else property.lerp(new THREE.Vector3().fromArray(v),weight);
  }
}
function restore(root,pose){for(const [name,p]of pose){const b=root.getObjectByName(name);b.position.copy(p.position);b.quaternion.copy(p.quaternion);b.scale.copy(p.scale);}}
function soleWorld(leg){return leg.foot.localToWorld(leg.sole.clone());}
function turnBoneWorld(bone,delta){const parentQ=bone.parent.getWorldQuaternion(new THREE.Quaternion()),world=bone.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(parentQ.invert().multiply(delta).multiply(world)).normalize();bone.updateWorldMatrix(false,true);}
function solveLeg(leg,target,footQ){
  const ankle=leg.foot.getWorldPosition(new THREE.Vector3()),offset=soleWorld(leg).sub(ankle),currentFootQ=leg.foot.getWorldQuaternion(new THREE.Quaternion());
  offset.applyQuaternion(currentFootQ.invert()).applyQuaternion(footQ);const desired=target.clone().sub(offset);
  const h=leg.hip.getWorldPosition(new THREE.Vector3()),k=leg.knee.getWorldPosition(new THREE.Vector3()),a=leg.foot.getWorldPosition(new THREE.Vector3()),l1=h.distanceTo(k),l2=k.distanceTo(a);
  const to=desired.clone().sub(h),distance=THREE.MathUtils.clamp(to.length(),.01,l1+l2-.0001),direction=to.normalize();
  let pole=k.clone().sub(h).addScaledVector(direction,-k.clone().sub(h).dot(direction));
  if(pole.lengthSq()<1e-8)pole=new THREE.Vector3(0,0,1).addScaledVector(direction,-direction.z);pole.normalize();
  const along=(l1*l1+distance*distance-l2*l2)/(2*distance),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  const kneeTarget=h.clone().addScaledVector(direction,along).addScaledVector(pole,bend);
  turnBoneWorld(leg.hip,new THREE.Quaternion().setFromUnitVectors(k.sub(h).normalize(),kneeTarget.clone().sub(h).normalize()));
  const kp=leg.knee.getWorldPosition(new THREE.Vector3()),ap=leg.foot.getWorldPosition(new THREE.Vector3());
  turnBoneWorld(leg.knee,new THREE.Quaternion().setFromUnitVectors(ap.sub(kp).normalize(),desired.sub(kp).normalize()));
  leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(footQ));leg.foot.updateWorldMatrix(false,true);
}
function groundNormal(ground,x,z){const e=.15;return new THREE.Vector3(ground(x-e,z)-ground(x+e,z),2*e,ground(x,z-e)-ground(x,z+e)).normalize();}
export function createAuthoredCharacter(avatar,library,role='traveler',hair=null){
  avatar.updateMatrixWorld(true);let sourceBody;avatar.traverse(o=>{if(o.isSkinnedMesh&&(!sourceBody||o.geometry.attributes.position.count>sourceBody.geometry.attributes.position.count))sourceBody=o;});
  if(!sourceBody)throw Error('Author body skin required');const bounds=new THREE.Box3().setFromBufferAttribute(sourceBody.geometry.attributes.position),height=bounds.max.y-bounds.min.y,scale=2.95/height;
  const needed=new Set(['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Swim_Fwd_Loop','Swim_Idle_Loop','Sword_Attack','Punch_Cross','PickUp_Table']);
  const rest=captureAuthorRest(avatar),clips=retargetAuthoredClips(avatar,captureAuthorRest(library.scene),library.animations.filter(c=>needed.has(c.name)),height/library.height);
  dressAuthoredAvatar(avatar,role);if(hair)attachAuthorHair(avatar,hair,role);
  const root=new THREE.Group(),body=new THREE.Group();body.scale.setScalar(scale);body.add(avatar);root.add(body);root.updateMatrixWorld(true);
  const legs=['l','r'].map((side,i)=>{const foot=avatar.getObjectByName('foot_'+side),sourceSole=new THREE.Vector3((i?-1:1)*.114, .004,-.015).multiplyScalar(scale);return {hip:avatar.getObjectByName('thigh_'+side),knee:avatar.getObjectByName('calf_'+side),foot,sole:foot.worldToLocal(sourceSole),restFootQ:foot.getWorldQuaternion(new THREE.Quaternion()),target:null,contact:null};});
  const compiledClips=new Map(clips.map(c=>[c.name,compiled(c,avatar)])),floors={};
  for(const name of ['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop']){
    const clip=compiledClips.get(name),min=[Infinity,Infinity];
    for(let i=0;i<60;i++){sample(clip,i/60*clip.duration);root.updateMatrixWorld(true);legs.forEach((leg,j)=>min[j]=Math.min(min[j],soleWorld(leg).y));}floors[name]=min;
  }
  restore(avatar,rest);root.updateMatrixWorld(true);
  const {tools,axe,sword}=createCharacterTools();tools.name='author-hand-tools';tools.position.set(.015,.06,.025);tools.rotation.x=Math.PI/2;tools.scale.setScalar(1/scale);avatar.getObjectByName('hand_r').add(tools);
  root.userData={authored:true,role,avatar,body,scale,legs,clips:compiledClips,floors,clock:createAuthoredPoseClock(scale),markers:library.markers??{},axe,sword,footfallCount:0,worldFeet:[],lastPosition:null,bodyMotion:{drive:0,turn:0},shoulders:['l','r'].map(s=>avatar.getObjectByName('upperarm_'+s)),elbows:['l','r'].map(s=>avatar.getObjectByName('lowerarm_'+s)),ankles:legs.map(l=>l.foot)};
  return root;
}
export function animateAuthoredCharacter(root,state,dt,ground=()=>0){
  const rig=root.userData;if(dt<=0&&rig.lastPosition&&rig.lastTime===state.time&&rig.lastPosition.x===state.x&&rig.lastPosition.z===state.z)return;
  if(!rig.lastPosition){root.rotation.y=state.yaw;rig.idleStep=null;rig.baseClip=null;rig.transitionFrom=null;rig.clock=createAuthoredPoseClock(rig.scale);for(const leg of rig.legs){leg.target=null;leg.contact=null;}}
  const floorHeight=ground(state.x,state.z),swimming=!!state.swimming&&.12-floorHeight>=1.8;
  const plan=rig.clock.update({...state,swimming},dt);rig.lastPosition={x:state.x,z:state.z};rig.lastTime=state.time;rig.plan=plan;
  root.position.set(state.x,swimming?Math.max(floorHeight,-.45):floorHeight,state.z);
  root.rotation.y+=Math.atan2(Math.sin(state.yaw-root.rotation.y),Math.cos(state.yaw-root.rotation.y))*(dt>0?1-Math.exp(-dt*16):1);
  const base=rig.clips.get(plan.baseClip),baseTime=plan.speed>.0001?plan.phase*base.duration:((state.time%base.duration)+base.duration)%base.duration;
  if(rig.baseClip&&rig.baseClip!==plan.baseClip){rig.transitionFrom=new Map([...rig.lastBasePose].map(([n,p])=>[n,{position:p.position.clone(),quaternion:p.quaternion.clone(),scale:p.scale.clone()}]));rig.transitionAt=state.time;}
  rig.baseClip=plan.baseClip;sample(base,baseTime);
  if(rig.transitionFrom){const weight=THREE.MathUtils.clamp((state.time-rig.transitionAt)/.18,0,1);for(const [name,p]of rig.transitionFrom){const b=rig.avatar.getObjectByName(name);b.position.lerp(p.position,1-weight);b.quaternion.slerp(p.quaternion,1-weight);b.scale.lerp(p.scale,1-weight);}if(weight===1)rig.transitionFrom=null;}
  if(!rig.lastBasePose)rig.lastBasePose=captureAuthorRest(rig.avatar);else for(const [name,p]of rig.lastBasePose){const b=rig.avatar.getObjectByName(name);p.position.copy(b.position);p.quaternion.copy(b.quaternion);p.scale.copy(b.scale);}
  rig.body.position.set(0,0,0);rig.body.rotation.set(-.06*plan.recoil,0,.03*plan.recoil);
  if(plan.action){
    const low=plan.action==='gather'&&['berry','fiber','shell'].includes(state.gatherKind),name=low?'PickUp_Table':plan.equipped==='hand'?'Punch_Cross':'Sword_Attack',clip=rig.clips.get(name);
    const marker=rig.markers[name]?.weaponForwardPhase?.[plan.equipped]??rig.markers[name]?.peakRightHandPhase??.5,p=plan.actionProgress;
    const sourcePhase=p<.5?p*2*marker:marker+(p-.5)*2*(1-marker);
    sample(clip,sourcePhase*clip.duration,true,Math.sin(p*Math.PI));rig.actionSource={name,phase:sourcePhase,marker,gameProgress:p};
  }else rig.actionSource=null;
  rig.axe.visible=plan.equipped==='axe';rig.sword.visible=plan.equipped==='sword';root.updateMatrixWorld(true);
  if(swimming){
    const chest=rig.avatar.getObjectByName('spine_03').getWorldPosition(new THREE.Vector3());rig.body.position.y=(.12-chest.y); // Body container is world-axis aligned; .12 is the production water plane.
    root.updateMatrixWorld(true);let clearance=0;for(const leg of rig.legs){const point=soleWorld(leg);clearance=Math.max(clearance,ground(point.x,point.z)-point.y);}if(clearance>0)rig.body.position.y+=clearance;
    rig.worldFeet=[];for(const leg of rig.legs){leg.target=null;leg.contact=null;}root.updateMatrixWorld(true);return;
  }
  if(plan.resetContacts||plan.speed>.0001)rig.idleStep=null;
  if(plan.baseClip==='Idle_Loop'&&!rig.transitionFrom&&!rig.idleStep){
    const gaps=rig.legs.map(leg=>{const raw=soleWorld(leg);return leg.target?Math.hypot(raw.x-leg.target.x,raw.z-leg.target.z):0;});const side=gaps[0]>gaps[1]?0:1;
    if(gaps[side]>.25)rig.idleStep={side,from:rig.legs[side].target.clone(),at:state.time};
  }
  const targets=[],orientations=[];
  for(const [j,leg]of rig.legs.entries()){
    const raw=soleWorld(leg),lift=raw.y-root.position.y-rig.floors[plan.baseClip][j];let contact=lift<=.035*rig.scale;
    const normal=groundNormal(ground,raw.x,raw.z),q=new THREE.Quaternion().setFromUnitVectors(up,normal).multiply(root.quaternion).multiply(leg.restFootQ);
    if(rig.idleStep?.side===j){
      const step=rig.idleStep,t=THREE.MathUtils.clamp((state.time-step.at)/.25,0,1),ease=t*t*(3-2*t);raw.x=THREE.MathUtils.lerp(step.from.x,raw.x,ease);raw.z=THREE.MathUtils.lerp(step.from.z,raw.z,ease);raw.y=ground(raw.x,raw.z)+.12*Math.sin(t*Math.PI);
      contact=t===1;if(contact&&leg.contact===false)rig.footfallCount++;leg.target=raw.clone();leg.contact=contact;targets.push(raw);orientations.push(q);if(t===1)rig.idleStep=null;continue;
    }
    if(plan.resetContacts){leg.target=null;leg.releasedUntilAir=false;leg.swingFrom=null;}
    if(lift>.05*rig.scale||plan.baseClip==='Idle_Loop'&&!rig.transitionFrom)leg.releasedUntilAir=false;
    if(contact&&leg.target&&leg.contact&&plan.speed>0){const h=leg.hip.getWorldPosition(new THREE.Vector3()),k=leg.knee.getWorldPosition(new THREE.Vector3()),a=leg.foot.getWorldPosition(new THREE.Vector3()),reach=h.distanceTo(k)+k.distanceTo(a);
      if(Math.hypot(h.x-leg.target.x,h.z-leg.target.z)>reach*.55)leg.releasedUntilAir=true;
    }
    if(leg.releasedUntilAir)contact=false;let swingLift=leg.releasedUntilAir?.08:0;
    if(!contact&&leg.contact&&leg.target){leg.swingFrom=leg.target.clone();leg.swingAt=state.time;}
    if(!contact&&leg.swingFrom){const t=THREE.MathUtils.clamp((state.time-leg.swingAt)/.14,0,1),ease=t*t*(3-2*t);raw.x=THREE.MathUtils.lerp(leg.swingFrom.x,raw.x,ease);raw.z=THREE.MathUtils.lerp(leg.swingFrom.z,raw.z,ease);swingLift=leg.releasedUntilAir?.08*Math.sin(t*Math.PI/2):.12*Math.sin(t*Math.PI);if(t===1)leg.swingFrom=null;}
    if(contact&&leg.target&&leg.contact){raw.x=leg.target.x;raw.z=leg.target.z;raw.y=leg.target.y;}
    else raw.y=ground(raw.x,raw.z)+(contact?0:Math.max(0,lift,swingLift));
    if(contact&&leg.contact===false)rig.footfallCount++;
    leg.target=raw.clone();leg.contact=contact;targets.push(raw);orientations.push(q);
  }
  // Reach correction moves the rendered pelvis only; authoritative world coordinates never change.
  let drop=0;
  rig.legs.forEach((leg,j)=>{if(!leg.contact)return;const h=leg.hip.getWorldPosition(new THREE.Vector3()),k=leg.knee.getWorldPosition(new THREE.Vector3()),a=leg.foot.getWorldPosition(new THREE.Vector3()),length=h.distanceTo(k)+k.distanceTo(a)-.02,offset=soleWorld(leg).sub(a).applyQuaternion(leg.foot.getWorldQuaternion(new THREE.Quaternion()).invert()).applyQuaternion(orientations[j]),target=targets[j].clone().sub(offset),horizontal=(h.x-target.x)**2+(h.z-target.z)**2;drop=Math.max(drop,h.y-target.y-Math.sqrt(Math.max(.01,length*length-horizontal)));});
  if(drop>0){const pelvis=rig.avatar.getObjectByName('pelvis'),position=pelvis.getWorldPosition(new THREE.Vector3());position.y-=Math.min(.6,drop);pelvis.position.copy(pelvis.parent.worldToLocal(position));root.updateMatrixWorld(true);}
  rig.legs.forEach((leg,j)=>solveLeg(leg,targets[j],orientations[j]));root.updateMatrixWorld(true);rig.worldFeet=targets;
}
export function authorSolePoints(root){return root.userData.legs.map(soleWorld);}
