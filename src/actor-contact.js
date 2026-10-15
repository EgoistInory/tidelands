// Conservative horizontal body footprints include the head/claws, but never an equipped tool.
export function actorRadius(actor){return actor.type==='boar'?2.2:actor.type==='crab'?1.95:actor.type==='npc'?.7:.35;}
export function actorBlocksMove(from,to,actor,movingRadius=.35,obstacleRadius=actorRadius(actor)){
  const radius=obstacleRadius+movingRadius,fx=from.x-actor.x,fz=from.z-actor.z,dx=to.x-from.x,dz=to.z-from.z;
  if(fx*fx+fz*fz<radius*radius-1e-10){
    // Existing overlapping saves can leave; no restore-time relocation or passing through the centre.
    return fx*dx+fz*dz< -1e-10;
  }
  const length=dx*dx+dz*dz;if(length<1e-18)return false;
  const t=Math.max(0,Math.min(1,-(fx*dx+fz*dz)/length));
  return (fx+dx*t)**2+(fz+dz*t)**2<radius*radius-1e-10;
}
export function targetReachPadding(actor){return actor?.type==='boar'?.35:0;}
