// Appended only by the isolated native-motion review; never included by production.
import {authorSolePoints as reviewSoles} from './authored-character.js';
const motionFrames=[];let dropped=0;
window.nativeMotionReview={active:false,snapshot:()=>structuredClone({frames:motionFrames,dropped})};
const nativeMotionDraw=WorldView.prototype.draw;
WorldView.prototype.draw=function(...args){
 nativeMotionDraw.apply(this,args);
 if(!window.nativeMotionReview.active||!this.player.userData.authored)return;
 const state=args[0],rig=this.player.userData,position=name=>this.player.getObjectByName(name).getWorldPosition(new THREE.Vector3()).toArray();
 const soles=reviewSoles(this.player).map(v=>v.toArray());
 motionFrames.push({time:state.time,dt:args[4],player:{x:state.player.x,z:state.player.z,yaw:state.player.yaw},baseClip:rig.plan.baseClip,phase:rig.plan.phase,speed:rig.plan.speed,action:rig.plan.action,footfalls:rig.footfallCount,contacts:rig.legs.map(l=>l.contact),soles,pelvis:position('pelvis'),head:position('Head'),hips:['thigh_l','thigh_r'].map(position),knees:['calf_l','calf_r'].map(position),camera:this.camera.position.toArray()});
 if(motionFrames.length>1800){motionFrames.shift();dropped++;}
};
