import * as THREE from '../vendor/three.module.min.js';

export function resetCreatureFeet(rig){rig.footState=null;rig.worldFeet=null;rig.footContacts=null;rig.idleFootTime=0;}

// Both rigs use the same two-link solve; only authored vectors and gait offsets differ.
export function placeCreatureFeet(root,heightAt,dt,moving){
  const rig=root.userData,boar=rig.type==='boar',duration=boar?.16:.22;
  const velocity=moving&&dt>0?new THREE.Vector3(root.position.x-rig.last.x,0,root.position.z-rig.last.z).multiplyScalar(1/dt):new THREE.Vector3();
  root.updateMatrixWorld(true);
  if(!rig.footState)rig.footState=rig.contacts.map(c=>{
    const p=rig.body.localToWorld(c.rest.clone());p.y=heightAt(p.x,p.z);return {point:p,from:p.clone(),elapsed:duration,planted:true,wasSwingWindow:false};
  });
  rig.idleFootTime=moving?0:(rig.idleFootTime??0)+dt;
  const anySwing=rig.footState.some(f=>!f.planted);
  let idleIndex=-1,idleGap=.14;
  if(!moving&&!anySwing&&rig.idleFootTime>.18)for(const [i,c]of rig.contacts.entries()){
    const neutral=rig.body.localToWorld(c.rest.clone()),gap=Math.hypot(neutral.x-rig.footState[i].point.x,neutral.z-rig.footState[i].point.z);
    if(gap>idleGap){idleIndex=i;idleGap=gap;}
  }
  const contacts=[];
  for(const [i,c]of rig.contacts.entries()){
    const f=rig.footState[i],neutral=rig.body.localToWorld(c.rest.clone());neutral.y=heightAt(neutral.x,neutral.z);
    const offset=boar?[0,.5,.5,0][i]:((i%4+Math.floor(i/4))%2)*.5;
    const phase=((rig.phase/(Math.PI*2)+offset)%1+1)%1,swingWindow=phase>.55;
    const hip=rig.body.localToWorld(c.hip.position.clone()),reach=hip.distanceTo(f.point),limit=(c.upper.length()+c.lower.length())*.975;
    const earlyLift=f.planted&&reach>limit;
    if(f.planted&&((moving&&swingWindow&&!f.wasSwingWindow)||earlyLift||idleIndex===i)){
      f.from.copy(f.point);f.elapsed=0;f.planted=false;
    }
    f.wasSwingWindow=swingWindow;
    if(!f.planted){
      f.elapsed=Math.min(duration,f.elapsed+dt);const t=f.elapsed/duration,ease=t*t*(3-2*t);
      const landing=neutral.clone().addScaledVector(velocity,.06);landing.y=heightAt(landing.x,landing.z);
      f.point.lerpVectors(f.from,landing,ease);f.point.y=Math.max(f.point.y,heightAt(f.point.x,f.point.z))+(boar?.14:.12)*Math.sin(t*Math.PI);
      if(t>=1){f.point.copy(landing);f.planted=true;}
    }
    const target=rig.body.worldToLocal(f.point.clone()).sub(c.hip.position),length=target.length(),a=c.upper.length(),b=c.lower.length();
    const clamped=THREE.MathUtils.clamp(length,Math.abs(a-b)+.0001,a+b-.0001),direction=target.clone().normalize();
    let pole=c.pole.clone().addScaledVector(direction,-c.pole.dot(direction));
    if(pole.lengthSq()<1e-8)pole=new THREE.Vector3(0,0,1).addScaledVector(direction,-direction.z);
    pole.normalize();const along=(a*a+clamped*clamped-b*b)/(2*clamped),bend=Math.sqrt(Math.max(0,a*a-along*along));
    const knee=direction.clone().multiplyScalar(along).addScaledVector(pole,bend);
    c.hip.quaternion.setFromUnitVectors(c.upper.clone().normalize(),knee.clone().normalize());
    const shin=direction.multiplyScalar(clamped).sub(knee).applyQuaternion(c.hip.quaternion.clone().invert());
    c.knee.quaternion.setFromUnitVectors(c.lower.clone().normalize(),shin.normalize());
    if(c.ankle){
      root.updateMatrixWorld(true);const parent=c.knee.getWorldQuaternion(new THREE.Quaternion());
      c.ankle.quaternion.copy(parent.invert().multiply(root.quaternion).multiply(rig.ground.quaternion));
    }
    // A clamped swing must not be counted as a planted foot in evidence or feedback.
    contacts.push(f.planted&&Math.abs(length-clamped)<.005);
  }
  root.updateMatrixWorld(true);
  rig.worldFeet=rig.contacts.map(c=>c.point.clone().applyMatrix4(c.leg.matrixWorld));rig.footContacts=contacts;
}
