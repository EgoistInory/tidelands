import * as THREE from '../vendor/three.module.min.js';
import {terrain} from './world.js';

const colors={tree:0xb9935e,stone:0xbcb7aa,crystal:0x91cfc2,berry:0x7e9956,fiber:0x9fae67,shell:0xe3d5b4,hit:0xe3c498};
function cueAt(state,target,kind){
  const dx=state.player.x-target.x,dz=state.player.z-target.z,distance=Math.hypot(dx,dz);
  // Feedback stays near the confirmed target; this is not a blade/mesh collision point.
  const radius=kind==='hit'?(target.type==='boar'?1:1.15):kind==='tree'?.4:['stone','crystal'].includes(kind)?.7*(target.scale??1):0;
  const offset=Math.min(radius,distance),x=target.x+(distance?dx/distance*offset:0),z=target.z+(distance?dz/distance*offset:0),floor=terrain(x,z);
  const height=kind==='hit'?(target.type==='boar'?1.3:1.15):kind==='tree'?1.3:['stone','crystal'].includes(kind)?Math.min(1.3,.8*(target.scale??1)):.35;
  return {id:target.id,kind,x,y:floor+height,z,floor,time:state.time};
}
export function gatherImpact(state,pending,message){
  return pending?.state===state&&pending.resolved&&typeof message==='string'&&message.includes(' +')&&Object.hasOwn(colors,pending.object.type)?cueAt(state,pending.object,pending.object.type):null;
}
export function attackImpacts(state,result){
  return (result?.hits??[]).flatMap(id=>{const target=state.enemies.find(e=>e.id===id);return target?[cueAt(state,target,'hit')]:[];});
}
export function createImpactFeedback(capacity=48){
  if(!Number.isInteger(capacity)||capacity<1||capacity>96)throw Error('Impact capacity must be between 1 and 96');
  const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({roughness:1}),mesh=new THREE.InstancedMesh(geometry,material,capacity),dummy=new THREE.Object3D(),color=new THREE.Color(),particles=Array(capacity).fill(null);
  mesh.name='confirmed-impact-chips';mesh.visible=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  let next=0,active=0,lastTime=null,disposed=false,dirty=false;
  function clear(){particles.fill(null);active=0;mesh.visible=false;lastTime=null;dirty=true;}
  return {mesh,get active(){return active;},clear,
    spawn(cue){
      if(disposed||!cue||!Object.hasOwn(colors,cue.kind)||![cue.x,cue.y,cue.z,cue.floor,cue.time].every(Number.isFinite))return false;
      for(let i=0;i<6;i++){
        const angle=i*Math.PI/3+.37,speed=1.4+i*.25,index=next;next=(next+1)%capacity;
        particles[index]={...cue,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,vy:1.1+(i%3)*.35,angle};
        mesh.setColorAt(index,color.setHex(colors[cue.kind]));
      }
      mesh.instanceColor.needsUpdate=true;dirty=true;return true;
    },
    update(time){
      if(disposed||!Number.isFinite(time))return;
      if(lastTime!==null&&time<lastTime){clear();return;}
      if(time===lastTime&&!dirty)return;lastTime=time;dirty=false;active=0;
      for(let i=0;i<capacity;i++){
        const p=particles[i],age=p?time-p.time:Infinity,alive=age>=0&&age<.45;
        if(alive){
          active++;const size=.11*(1-age/.45);
          dummy.position.set(p.x+p.vx*age,Math.max(p.floor+.02,p.y+p.vy*age-4.9*age*age),p.z+p.vz*age);
          dummy.rotation.set(age*6,p.angle+age*4,age*3);dummy.scale.set(size,p.kind==='tree'?size*.32:size*.65,size*.45);
        }else{particles[i]=null;dummy.scale.setScalar(0);}
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.visible=active>0;
    },
    dispose(){if(disposed)return;disposed=true;clear();geometry.dispose();material.dispose();}
  };
}
