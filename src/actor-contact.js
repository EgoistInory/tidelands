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

// Swept gameplay spheres follow terrain at 0.1 m intervals; these are not mesh colliders.
export function actorBlocksMove3D(from,to,actor,heightAt,movingRadius=.35,obstacleRadius=actorRadius(actor)){
  const radius=movingRadius+obstacleRadius,fx=from.x-actor.x,fz=from.z-actor.z,dx=to.x-from.x,dz=to.z-from.z;
  const length=dx*dx+dz*dz,t=length>1e-18?Math.max(0,Math.min(1,-(fx*dx+fz*dz)/length)):0;
  // Vertical distance can only increase separation. Skip terrain queries for distant actors.
  if((fx+dx*t)**2+(fz+dz*t)**2>=radius*radius-1e-10)return false;
  const base=heightAt(actor.x,actor.z),count=Math.max(1,Math.ceil(Math.sqrt(length)/.1));
  let ax=fx,ay=heightAt(from.x,from.z)-base,az=fz;
  for(let i=1;i<=count;i++){
    const bx=fx+dx*i/count,bz=fz+dz*i/count,by=heightAt(actor.x+bx,actor.z+bz)-base;
    const vx=bx-ax,vy=by-ay,vz=bz-az,dot=ax*vx+ay*vy+az*vz,size=vx*vx+vy*vy+vz*vz;
    if(ax*ax+ay*ay+az*az<radius*radius-1e-10){if(dot< -1e-10)return true;}
    else if(size>1e-18){const u=Math.max(0,Math.min(1,-dot/size));if((ax+u*vx)**2+(ay+u*vy)**2+(az+u*vz)**2<radius*radius-1e-10)return true;}
    ax=bx;ay=by;az=bz;
  }
  return false;
}
