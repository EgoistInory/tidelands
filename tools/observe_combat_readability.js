// Append only to a diagnostic scene.js response. Serve the imported QA module explicitly.
// NDC centres and sampled terrain clearance are diagnostics, NOT mesh visibility proof.
import {createCombatObservation} from '/tools/combat_observation.js';
const combatDraw=WorldView.prototype.draw;
const combatHistory=createCombatObservation(2400);
window.combatReadability={active:false,snapshot:()=>combatHistory.snapshot()};
WorldView.prototype.draw=function(state,...args){
 const result=combatDraw.call(this,state,...args);
 if(!window.combatReadability.active)return result;
 const p=state.player;
 function target(x,y,z){
  const v=new THREE.Vector3(x,y,z),ndc=v.clone().project(this.camera);
  let minimumClearance=Infinity;
  for(let i=1;i<32;i++){const at=this.camera.position.clone().lerp(v,i/32);minimumClearance=Math.min(minimumClearance,at.y-terrain(at.x,at.z));}
  return {world:v.toArray(),ndc:ndc.toArray(),sampledTerrainClearance:minimumClearance};
 }
 combatHistory.record({time:state.time,wall:performance.now(),player:{...p},
  camera:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),fov:this.camera.fov,
  playerTarget:target.call(this,p.x,terrain(p.x,p.z)+1.2,p.z),
  enemies:state.enemies.filter(e=>Math.hypot(e.x-p.x,e.z-p.z)<20).map(e=>({...e,target:target.call(this,e.x,terrain(e.x,e.z)+.5,e.z)}))});
 return result;
};
