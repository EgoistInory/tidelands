// Appended to the local scene response for the route audit only.
import {authorSolePoints as highlandSoles} from './authored-character.js';

const highlandDraw=WorldView.prototype.draw,highlandFrames=[];
window.highlandMotion={active:false,frames:highlandFrames};
WorldView.prototype.draw=function(...args){
  highlandDraw.apply(this,args);
  if(!window.highlandMotion.active)return;
  if(highlandFrames.length>=4800)throw Error('Highland motion frame budget exhausted');
  const actor=this.islanders.find(({object})=>object.id==='explorer').model;
  const measure=model=>{
    const rig=model.userData;
    const soles=highlandSoles(model);
    return {yaw:model.rotation.y,clip:rig.plan.baseClip,step:rig.idleStep?.side??null,
      position:model.position.toArray(),contacts:rig.legs.map(leg=>leg.contact),footfalls:rig.footfallCount,
      gaps:soles.map(point=>point.y-terrain(point.x,point.z)),
      targetErrors:soles.map((point,side)=>rig.worldFeet[side]?point.distanceTo(rig.worldFeet[side]):null)};
  };
  highlandFrames.push({time:args[0].time,wall:performance.now(),player:measure(this.player),
    explorer:measure(actor),camera:this.camera.position.toArray()});
};
