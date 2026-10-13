// An uninterrupted input keeps its direction when scenery turns the camera.
export function createMovementHeading(){
  let heldYaw=null;
  return {
    begin(yaw){if(heldYaw===null)heldYaw=yaw;},
    end(stillActive=false){if(!stillActive)heldYaw=null;},
    turn(delta){if(heldYaw!==null)heldYaw+=delta;},
    relative(x,z,yaw){const angle=heldYaw??yaw;return {x:x*Math.cos(angle)+z*Math.sin(angle),z:-x*Math.sin(angle)+z*Math.cos(angle)};}
  };
}
