// Keep one owner per control; a second finger must not steal an active drag.
export function bindPointerControls(world,joystick,{enabled,stick,look,zoom}){
  let drag=null,owner=null;
  const release=(element,id)=>{if(id!==null&&element.hasPointerCapture(id))element.releasePointerCapture(id);};
  function reset(){const dragId=drag?.id??null,stickId=owner;drag=null;owner=null;stick.x=stick.z=0;joystick.firstElementChild.style.transform='';release(world,dragId);release(joystick,stickId);}
  world.addEventListener('pointerdown',e=>{if(!enabled()||drag||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};world.setPointerCapture(e.pointerId);});
  world.addEventListener('pointermove',e=>{if(!enabled()||!drag||drag.id!==e.pointerId)return;look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])world.addEventListener(type,e=>{if(drag?.id===e.pointerId)drag=null;});
  world.addEventListener('wheel',e=>{e.preventDefault();if(enabled())zoom(e.deltaY);},{passive:false});
  const move=e=>{const r=joystick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,z=e.clientY-r.top-r.height/2,n=Math.max(36,Math.hypot(x,z));stick.x=x/n;stick.z=z/n;joystick.firstElementChild.style.transform=`translate(${stick.x*30}px,${stick.z*30}px)`;};
  joystick.addEventListener('pointerdown',e=>{if(!enabled()||owner!==null||e.button!==0)return;owner=e.pointerId;joystick.setPointerCapture(owner);move(e);});
  joystick.addEventListener('pointermove',e=>{if(enabled()&&owner===e.pointerId)move(e);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,e=>{if(owner===e.pointerId){owner=null;stick.x=stick.z=0;joystick.firstElementChild.style.transform='';}});
  return reset;
}
