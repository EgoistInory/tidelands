const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

// Sample real travel and the rendered facing; actions still own their individual poses.
export function updateBodyMotion(rig,x,z,yaw,dt,reset=false){
  const prior=rig.bodyMotion;
  if(reset||!prior||!(dt>0)||dt>.1){
    return rig.bodyMotion={x,z,yaw,speed:0,drive:0,turn:0};
  }
  const speed=Math.min(12,Math.hypot(x-prior.x,z-prior.z)/dt),blend=1-Math.exp(-12*dt);
  const acceleration=clamp((speed-prior.speed)/dt/12,-1,1);
  const angular=clamp(Math.atan2(Math.sin(yaw-prior.yaw),Math.cos(yaw-prior.yaw))/dt/5,-1,1);
  return rig.bodyMotion={x,z,yaw,speed,drive:prior.drive+(acceleration-prior.drive)*blend,turn:prior.turn+(angular-prior.turn)*blend};
}
