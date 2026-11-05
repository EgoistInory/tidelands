// Appended to the served scene module only during the declared read-only diagnostic run.
// It observes the existing draw; it never changes state, camera, actors or the game clock.
import {authorSolePoints as reviewSolePoints} from './authored-character.js';
const reviewDraw=WorldView.prototype.draw;
WorldView.prototype.draw=function(state,near,placement,moving,dt){
 const result=reviewDraw.call(this,state,near,placement,moving,dt),review=window.movementReview;
 if(!review?.active||!this.player.userData.authored)return result;
 const p=state.player,rig=this.player.userData,feet=reviewSolePoints(this.player),h=terrain(p.x,p.z),camera=this.camera.position;
 const focus=new THREE.Vector3(p.x,h+1.4,p.z).project(this.camera),yaw=Math.atan2(camera.x-p.x,camera.z-p.z);
 const gaps=feet.map(f=>f.y-terrain(f.x,f.z)),contacts=rig.legs.map(l=>!!l.contact),errors=feet.map((f,i)=>rig.worldFeet[i]?f.distanceTo(rig.worldFeet[i]):0);
 const previous=review.previous,elapsed=previous?state.time-previous.time:0,valid=elapsed>0&&elapsed<=.06;
 const yawStep=valid?Math.abs(Math.atan2(Math.sin(yaw-previous.yaw),Math.cos(yaw-previous.yaw))):0;
 const row=[state.time,p.x,p.z,h,dt,camera.x,camera.y,camera.z,focus.x,focus.y,...gaps,...contacts.map(Number),...errors,valid?yawStep/elapsed:0,rig.plan.speed,moving?1:0];
 if(review.rows.length>=40000)throw Error('Bounded movement observation reached 40000 frames');review.rows.push(row);
 const measures={contactPenetration:Math.max(0,...gaps.map((g,i)=>contacts[i]?-g:0)),contactError:Math.max(0,...errors.map((e,i)=>contacts[i]?e:0)),cameraYawRate:valid?yawStep/elapsed:0};
 for(const [name,value] of Object.entries(measures))if(!review.worst[name]||value>review.worst[name].value){
  const bones={};rig.avatar.traverse(o=>{if(o.isBone)bones[o.name]={position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()};});
  review.worst[name]={value,frame:review.rows.length-1,row,player:{...p},time:state.time,selected:state.selected,attackAt:state.attackAt,gatherAt:this.gatherAt,gatherKind:this.gatherKind,hurtAt:this.hurtAt,plan:{...rig.plan},root:{position:this.player.position.toArray(),quaternion:this.player.quaternion.toArray()},body:{position:rig.body.position.toArray(),quaternion:rig.body.quaternion.toArray()},feet:feet.map(f=>f.toArray()),targets:rig.worldFeet.map(f=>f.toArray()),contacts,bones};
 }
 review.previous={time:state.time,yaw};return result;
};
