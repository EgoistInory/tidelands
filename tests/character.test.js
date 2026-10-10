import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,animateCharacter} from '../src/character.js';
import * as THREE from '../vendor/three.module.min.js';
import {terrain} from '../src/world.js';
test('carried sword stays above flat ground at rest while remaining attached to the right hand',()=>{
  const c=createCharacter();
  for(let frame=0;frame<120;frame++)animateCharacter(c,{x:0,z:0,yaw:0,time:frame/60,attackAt:-100,selected:'sword'},1/60,()=>0);
  c.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(c.userData.sword);
  assert.ok(bounds.min.y>.12,`carried blade needs ground clearance, got ${bounds.min.y}`);
  assert.equal(c.userData.sword.parent.parent,c.userData.elbows[1]);
});
test('equipment follows selection and swings on the arm holding the tool',()=>{
  const c=createCharacter(),s={x:0,z:0,yaw:0,time:10,attackAt:0,selected:'axe'};
  animateCharacter(c,s,.016);assert.equal(c.userData.axe.visible,true);assert.equal(c.userData.sword.visible,false);
  animateCharacter(c,{...s,selected:'sword',attackAt:9.8},.016);assert.equal(c.userData.axe.visible,false);assert.equal(c.userData.sword.visible,true);assert.ok(c.userData.shoulders[1].rotation.x<-1);
  animateCharacter(c,{...s,selected:'hand'},.016);assert.equal(c.userData.sword.visible,false);assert.equal(c.userData.axe.visible,false);
});
test('attack and gathering enter and leave each equipped resting pose without snapping',()=>{
  const pose=c=>[c.userData.body.rotation.x,c.userData.shoulders[1].rotation.x,c.userData.elbows[1].rotation.x];
  for(const selected of ['hand','axe','sword'])for(const action of ['attack','gather']){
    const c=createCharacter(),duration=action==='attack'?.45:.42;
    const state={x:0,z:0,yaw:0,time:10,attackAt:-100,gatherAt:-100,selected};
    animateCharacter(c,state,1/60,()=>0);const resting=pose(c);
    state[action+'At']=10;animateCharacter(c,state,1/60,()=>0);
    pose(c).forEach((v,i)=>assert.ok(Math.abs(v-resting[i])<1e-8,`${selected}/${action} start joint ${i}`));
    state.time=10+duration-1e-6;animateCharacter(c,state,1/60,()=>0);const ending=pose(c);
    state.time+=2e-6;animateCharacter(c,state,1/60,()=>0);
    pose(c).forEach((v,i)=>assert.ok(Math.abs(v-ending[i])<.00002,`${selected}/${action} end joint ${i}`));
    assert.deepEqual(c.position.toArray(),[0,0,0]);
    assert.ok(pose(c).every(Number.isFinite));
  }
});
test('stride advances with distance, stays still at rest, and keeps joints attached',()=>{
  const c=createCharacter(),s={x:0,z:0,yaw:0,time:1,attackAt:-100,selected:'hand'};
  animateCharacter(c,s,.016);animateCharacter(c,{...s,time:2},.016);assert.equal(c.userData.phase,0);
  animateCharacter(c,{...s,x:.2},.016);assert.ok(c.userData.phase>0);assert.notEqual(c.userData.hips[0].rotation.x,0);
  assert.equal(c.userData.knees[0].parent,c.userData.hips[0]);assert.equal(c.userData.elbows[1].parent,c.userData.shoulders[1]);
});
test('gathering reaches forward, yields to attack or swimming, and returns to idle',()=>{
  const c=createCharacter(),s={x:0,z:0,yaw:0,time:10,attackAt:-100,gatherAt:9.79,selected:'axe'};
  animateCharacter(c,s,.016);assert.ok(c.userData.body.rotation.x>0);assert.equal(c.userData.shoulders[1].rotation.x,-1.6);
  animateCharacter(c,{...s,attackAt:9.775},.016);assert.ok(c.userData.shoulders[1].rotation.x<-2);assert.equal(c.userData.body.rotation.x,0);
  animateCharacter(c,{...s,swimming:true},.016);assert.equal(c.userData.body.rotation.x,1.25);
  animateCharacter(c,{...s,time:11},.016);assert.equal(c.userData.body.rotation.x,0);assert.ok(Math.abs(c.userData.shoulders[1].rotation.x)<1e-9);
});

test('hurt recoil decays without moving the root or leaving a swimming lean behind',()=>{
  const c=createCharacter(),s={x:0,z:0,yaw:0,time:10,attackAt:-100,hurtAt:10,selected:'hand'};
  animateCharacter(c,s,.016);
  assert.equal(c.userData.body.position.z,-.12);assert.equal(c.userData.body.rotation.x,-.18);
  assert.deepEqual(c.position.toArray(),[0,0,0]);
  animateCharacter(c,{...s,time:10.15},.016);
  assert.ok(Math.abs(c.userData.body.position.z+.06)<1e-9);
  animateCharacter(c,{...s,time:10.4,swimming:true},.016);
  assert.equal(c.userData.body.rotation.x,1.25);
  assert.ok(Math.abs(c.userData.body.position.z)<1e-9);assert.equal(c.userData.body.rotation.z,0);
  animateCharacter(c,{...s,time:9},.016);
  assert.equal(c.userData.body.rotation.x,0);assert.equal(c.userData.body.rotation.z,0);
});

test('steady forward stance keeps soles on a flat floor at several frame rates and production speeds',()=>{
  for(const fps of [30,60,144])for(const speed of [2.4,7,12]){
    const c=createCharacter(),dt=1/fps,last=[null,null],point=new THREE.Vector3(),rotation=new THREE.Quaternion();let contacts=0;
    for(let frame=0;frame<fps*4;frame++){
      const z=frame*dt*speed,time=frame*dt;c.position.z=z;
      animateCharacter(c,{x:0,z,yaw:0,time,attackAt:-100,selected:'hand'},dt,()=>0);c.updateMatrixWorld(true);
      for(let side=0;side<2;side++){
        const cycle=(c.userData.phase+side*Math.PI)/(Math.PI*2),stance=c.userData.footContacts[side];
        c.userData.ankles[side].getWorldPosition(point);c.userData.ankles[side].getWorldQuaternion(rotation);
        assert.ok(Math.abs(rotation.x)+Math.abs(rotation.z)<1e-8);
        if(stance){assert.ok(Math.abs(point.y-.145)<1e-8);
          if(time>1&&last[side]?.cycle===Math.floor(cycle)&&last[side].stance){assert.ok(Math.abs(point.z-last[side].z)<1e-5);contacts++;}
        }
        last[side]={z:point.z,stance,cycle:Math.floor(cycle)};
      }
    }
    assert.ok(contacts>fps);
  }
});

test('feet solve gentle terrain height, settle at rest and reset safely after a teleport',()=>{
  const c=createCharacter(),ground=(x,z)=>x*.03+z*.04,point=new THREE.Vector3(),normal=new THREE.Vector3(-.03,1,-.04).normalize(),orientation=new THREE.Quaternion();
  for(let frame=0;frame<180;frame++){
    const z=frame/60*2;c.position.set(0,ground(0,z),z);
    animateCharacter(c,{x:0,z,yaw:0,time:frame/60,attackAt:-100,selected:'hand'},1/60,ground);c.updateMatrixWorld(true);
    for(let side=0;side<2;side++){
      c.userData.ankles[side].getWorldPosition(point);
      if(c.userData.footContacts[side]){
        assert.ok(Math.abs((point.y-ground(point.x,point.z))*normal.y-.145)<1e-8);
        c.userData.ankles[side].getWorldQuaternion(orientation);
        assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(orientation).distanceTo(normal)<1e-8);
      }
    }
  }
  const phase=c.userData.phase,z=c.position.z;
  for(let frame=0;frame<120;frame++)animateCharacter(c,{x:0,z,yaw:0,time:3+frame/60,attackAt:-100,selected:'hand'},1/60,ground);
  assert.equal(c.userData.phase,phase);assert.ok(c.userData.walkBlend<1e-8);
  c.position.z=100;c.position.y=ground(0,100);
  animateCharacter(c,{x:0,z:100,yaw:0,time:5,attackAt:-100,selected:'hand'},1/60,ground);c.updateMatrixWorld(true);
  assert.equal(c.userData.phase,0);
  assert.equal(c.userData.strideLength,1.6);assert.equal(c.userData.stanceFraction,.6);
  for(const joint of [...c.userData.hips,...c.userData.knees,...c.userData.ankles])assert.ok(joint.quaternion.toArray().every(Number.isFinite));
  assert.equal(c.userData.ankles[0].parent,c.userData.knees[0]);
});

test('shaped boot soles have a flat contact face and stay above sloped floors during planted turns',()=>{
  for(const fps of [30,60,144]){
    const c=createCharacter(),dt=1/fps,ground=(x,z)=>.03*x+.12*z;let x=0,z=0,checked=0;
    const soles=c.userData.ankles.map(ankle=>ankle.getObjectByName('boot-sole'));
    for(const sole of soles){
      sole.geometry.computeBoundingBox();const box=sole.geometry.boundingBox;
      assert.ok(Math.abs(box.min.y+.145)<1e-8);assert.ok(Math.abs(box.max.y+.085)<1e-8);
      assert.ok(box.max.z>.38&&box.min.z<-.16);assert.ok(box.max.x-box.min.x<.32);
    }
    for(let frame=0;frame<=fps*3;frame++){
      const time=frame*dt,yaw=time>=1.5?Math.PI/2:0;
      if(frame&&time<2.3){x+=Math.sin(yaw)*7*dt;z+=Math.cos(yaw)*7*dt;}
      c.position.set(x,ground(x,z),z);animateCharacter(c,{x,z,yaw,time,attackAt:-100,selected:'sword'},dt,ground);c.updateMatrixWorld(true);
      for(let side=0;side<2;side++)if(c.userData.footContacts[side]){
        const sole=soles[side],positions=sole.geometry.attributes.position;let lowest=Infinity;
        for(let vertex=0;vertex<positions.count;vertex++){
          const point=new THREE.Vector3().fromBufferAttribute(positions,vertex).applyMatrix4(sole.matrixWorld);
          const gap=(point.y-ground(point.x,point.z))/Math.sqrt(1+.03**2+.12**2);
          lowest=Math.min(lowest,gap);assert.ok(gap>=-1e-7,`fps=${fps} frame=${frame} sole penetrated ${gap}`);
        }
        assert.ok(Math.abs(lowest)<1e-7);checked++;
      }
    }
    assert.ok(checked>fps);
  }
});

test('swimming leans forward with the head above the water and returns to planted feet',()=>{
  const c=createCharacter();c.position.y=-.45;
  const state={x:0,z:0,yaw:0,time:1,attackAt:-100,selected:'hand'};
  animateCharacter(c,{...state,swimming:true},1/60);c.updateMatrixWorld(true);
  const head=c.userData.body.localToWorld(new THREE.Vector3(0,2.65,0)),hip=c.userData.body.localToWorld(new THREE.Vector3(0,1.28,0));
  assert.ok(head.z>hip.z+1);assert.ok(head.y>.25&&head.y<.6);
  for(let frame=0;frame<180;frame++){
    animateCharacter(c,{...state,time:frame/60,swimming:true},1/60);c.updateMatrixWorld(true);
    for(const ankle of c.userData.ankles){const height=ankle.getWorldPosition(new THREE.Vector3()).y;assert.ok(height>-.65&&height<.1);}
  }
  c.position.y=0;animateCharacter(c,{...state,time:2},1/60,()=>0);c.updateMatrixWorld(true);
  assert.equal(c.userData.body.rotation.x,0);
  assert.ok(Math.abs(c.userData.ankles[0].getWorldPosition(new THREE.Vector3()).y-.145)<1e-8);
});

test('stopping keeps grounded boots fixed while recovery steps return them to a neutral stance',()=>{
  for(const fps of [30,60,144]){
    const c=createCharacter(),dt=1/fps,ground=(x,z)=>x*.03+z*.04,normal=new THREE.Vector3(-.03,1,-.04).normalize();
    for(let frame=0;frame<=fps*2;frame++){
      const z=frame*dt*7;c.position.set(0,ground(0,z),z);
      animateCharacter(c,{x:0,z,yaw:0,time:frame*dt,attackAt:-100,selected:'hand'},dt,ground);
    }
    c.updateMatrixWorld(true);const prior=c.userData.ankles.map((ankle,i)=>({point:ankle.getWorldPosition(new THREE.Vector3()),contact:c.userData.footContacts[i]}));let recoveryFrames=0;
    for(let frame=1;frame<=fps*2;frame++){
      animateCharacter(c,{x:0,z:c.position.z,yaw:.25,time:2+frame*dt,attackAt:-100,selected:'hand'},dt,ground);c.updateMatrixWorld(true);
      for(let side=0;side<2;side++){
        const point=c.userData.ankles[side].getWorldPosition(new THREE.Vector3());
        const contact=c.userData.footContacts[side];
        if(contact&&prior[side].contact)assert.ok(Math.hypot(point.x-prior[side].point.x,point.z-prior[side].point.z)<1e-8);
        if(contact){
          assert.ok(Math.abs((point.y-ground(point.x,point.z))*normal.y-.145)<1.1e-8);
          const orientation=c.userData.ankles[side].getWorldQuaternion(new THREE.Quaternion());
          assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(orientation).distanceTo(normal)<1e-8);
        }
        if(!contact)recoveryFrames++;
        prior[side]={point,contact};
      }
    }
    assert.ok(c.userData.walkBlend<1e-8);
    assert.ok(recoveryFrames>0);
    for(let side=0;side<2;side++){const local=c.worldToLocal(prior[side].point.clone());assert.ok(Math.abs(local.z)<.02);assert.ok(Math.abs(local.x-c.userData.hips[side].position.x)<.02);}
  }
});

test('a right-angle turn keeps stance boots fixed during startup and steady travel on a slope',()=>{
  for(const fps of [30,60,144])for(const speed of [2.4,7,12]){
    const c=createCharacter(),dt=1/fps,ground=(x,z)=>x*.03+z*.04,normal=new THREE.Vector3(-.03,1,-.04).normalize(),prior=[null,null];let x=0,z=0,contacts=0;
    for(let frame=0;frame<fps*4;frame++){
      const yaw=frame>=fps*2?Math.PI/2:0,time=frame*dt;
      if(frame){x+=Math.sin(yaw)*speed*dt;z+=Math.cos(yaw)*speed*dt;}
      c.position.set(x,ground(x,z),z);animateCharacter(c,{x,z,yaw,time,attackAt:-100,selected:'hand'},dt,ground);c.updateMatrixWorld(true);
      for(let side=0;side<2;side++){
        const cycle=(c.userData.phase+side*Math.PI)/(2*Math.PI),stance=c.userData.footContacts[side],point=c.userData.ankles[side].getWorldPosition(new THREE.Vector3()),last=prior[side];
        if(stance){
          assert.ok(Math.abs((point.y-ground(point.x,point.z))*normal.y-.145)<1e-8);
          if(last?.stance&&last.cycle===Math.floor(cycle)){
            assert.ok(point.distanceTo(last.point)<1e-8,`fps=${fps} speed=${speed} frame=${frame} drift=${point.distanceTo(last.point)}`);contacts++;
          }
        }
        prior[side]={point,stance,cycle:Math.floor(cycle)};
      }
    }
    assert.ok(contacts>fps);
  }
});

test('reversing releases an overextended foot instead of dragging its planted contact',()=>{
  for(const fps of [30,60,144]){
    const c=createCharacter(),dt=1/fps,prior=[null,null];let z=0,released=0,contacts=0;
    for(let frame=0;frame<fps*4;frame++){
      const yaw=frame>=fps*2?Math.PI:0,time=frame*dt;if(frame)z+=Math.cos(yaw)*7*dt;
      c.position.z=z;animateCharacter(c,{x:0,z,yaw,time,attackAt:-100,selected:'hand'},dt,()=>0);c.updateMatrixWorld(true);
      for(let side=0;side<2;side++){
        const point=c.userData.ankles[side].getWorldPosition(new THREE.Vector3()),stance=c.userData.footContacts[side],cycle=Math.floor((c.userData.phase+side*Math.PI)/(2*Math.PI)),last=prior[side];
        if(c.userData.earlyLift[side]!==null)released++;
        assert.ok(point.toArray().every(Number.isFinite));assert.ok(point.y>=.145-1e-8);
        if(stance){assert.ok(Math.abs(point.y-.145)<1e-8);if(last?.stance&&last.cycle===cycle){assert.ok(point.distanceTo(last.point)<1e-8);contacts++;}}
        prior[side]={point,stance,cycle};
      }
    }
    assert.ok(released>0);assert.ok(contacts>fps);
  }
});

test('teleport and swimming discard old world contacts before returning to a distant shore',()=>{
  const c=createCharacter(),state={yaw:0,time:0,attackAt:-100,selected:'hand'};
  for(let frame=0;frame<120;frame++){const z=frame/60*7;c.position.z=z;animateCharacter(c,{...state,x:0,z,time:frame/60},1/60,()=>0);}
  c.position.set(100,0,100);animateCharacter(c,{...state,x:100,z:100,time:3},1/60,()=>0);c.updateMatrixWorld(true);
  assert.equal(c.userData.phase,0);
  for(const ankle of c.userData.ankles)assert.ok(ankle.getWorldPosition(new THREE.Vector3()).distanceTo(c.position)<1);
  c.position.y=-.45;animateCharacter(c,{...state,x:100,z:100,time:4,swimming:true},1/60);
  assert.equal(c.userData.worldFeet,null);assert.equal(c.userData.landingFeet,null);
  assert.equal(c.userData.strideLength,1.6);assert.equal(c.userData.stanceFraction,.6);
  c.position.set(130,0,140);animateCharacter(c,{...state,x:130,z:140,time:5},1/60,()=>0);c.updateMatrixWorld(true);
  for(const ankle of c.userData.ankles){const point=ankle.getWorldPosition(new THREE.Vector3());assert.ok(point.distanceTo(c.position)<1);assert.ok(Math.abs(point.y-.145)<1e-8);}
});

test('batched movement never reuses a distant landing when key presses skip a swing',()=>{
  for(const batch of [1,2,3,4]){
    const c=createCharacter();let x=-53.3,z=104.9,time=0;
    c.position.set(x,terrain(x,z),z);animateCharacter(c,{x,z,yaw:0,time,attackAt:-100,selected:'sword'},1/60,terrain);
    for(let press=0;press<12;press++){
      time+=1/60;x-=.0583*batch;z-=.416*batch;c.position.set(x,terrain(x,z),z);
      animateCharacter(c,{x,z,yaw:-3,time,attackAt:-100,selected:'sword'},1/60,terrain);c.updateMatrixWorld(true);
      assert.ok(c.userData.body.position.y>-.75,`batch=${batch} press=${press} pelvis=${c.userData.body.position.y}`);
    }
    for(let frame=0;frame<180;frame++){time+=1/60;animateCharacter(c,{x,z,yaw:-3,time,attackAt:-100,selected:'sword'},1/60,terrain);}
    c.updateMatrixWorld(true);
    for(const ankle of c.userData.ankles){
      const point=ankle.getWorldPosition(new THREE.Vector3());
      assert.ok(Math.hypot(point.x-x,point.z-z)<1.1);
      assert.ok(Math.abs(point.y-terrain(point.x,point.z)-.145)<.015);
    }
  }
});

test('movement and swimming can interrupt idle recovery without retaining a sideways body offset',()=>{
  const c=createCharacter(),state={x:0,z:0,yaw:0,time:0,attackAt:-100,selected:'hand'};
  for(let frame=0;frame<120;frame++){state.z=frame/60*7;state.time=frame/60;c.position.z=state.z;animateCharacter(c,state,1/60,()=>0);}
  for(let frame=0;frame<20;frame++){state.time+=1/60;animateCharacter(c,state,1/60,()=>0);}
  assert.ok(Math.abs(c.userData.body.position.x)>.001);
  state.z+=7/60;state.time+=1/60;c.position.z=state.z;animateCharacter(c,state,1/60,()=>0);c.updateMatrixWorld(true);
  assert.equal(c.userData.body.position.x,0);assert.equal(c.userData.idleStep,null);
  for(const ankle of c.userData.ankles){const point=ankle.getWorldPosition(new THREE.Vector3());assert.ok(point.toArray().every(Number.isFinite));assert.ok(Math.hypot(point.x,point.z-state.z)<1.1);}
  for(let frame=0;frame<20;frame++){state.time+=1/60;animateCharacter(c,state,1/60,()=>0);}
  animateCharacter(c,{...state,swimming:true},1/60);
  assert.equal(c.userData.body.position.x,0);assert.equal(c.userData.idleStep,null);assert.equal(c.userData.worldFeet,null);
});

test('turning anticipates overextended contacts and bounds airborne targets without a deep pelvis collapse',()=>{
  for(const fps of [30,60,144])for(const speed of [2.4,7,12])for(const turn of [Math.PI/2,Math.PI]){
    const c=createCharacter(),dt=1/fps,ground=(x,z)=>.03*x+.04*z;let x=0,z=0,swings=0;
    animateCharacter(c,{x,z,yaw:0,time:0,attackAt:-100,selected:'hand'},dt,ground);
    for(let frame=1;frame<=fps*4;frame++){
      const time=frame*dt,yaw=time>=2?turn:0;x+=Math.sin(yaw)*speed*dt;z+=Math.cos(yaw)*speed*dt;
      c.position.set(x,ground(x,z),z);animateCharacter(c,{x,z,yaw,time,attackAt:-100,selected:'hand'},dt,ground);c.updateMatrixWorld(true);
      assert.ok(c.userData.body.position.y>-.45,`fps=${fps} speed=${speed} turn=${turn} frame=${frame} pelvis=${c.userData.body.position.y}`);
      for(let side=0;side<2;side++)if(!c.userData.footContacts[side]){
        const local=c.worldToLocal(c.userData.ankles[side].getWorldPosition(new THREE.Vector3()));
        const center=c.userData.hips[side].position.clone().applyQuaternion(c.userData.body.quaternion).add(c.userData.body.position);
        assert.ok(Math.hypot(local.x-center.x,local.z-center.z)<.76000001);swings++;
      }
    }
    assert.ok(swings>fps);
  }
});

test('faster travel lengthens the stride, lowers cadence and includes an airborne interval',()=>{
  for(const fps of [30,60,144])for(const [speed,length,stance] of [[2.4,1.6,.6],[7,3.2,.4],[12,5,.26]]){
    const c=createCharacter(),dt=1/fps;let startPhase=0,flights=0;
    animateCharacter(c,{x:0,z:0,yaw:0,time:0,attackAt:-100,selected:'hand'},dt,()=>0);
    for(let frame=1;frame<=fps*4;frame++){
      const z=frame*speed*dt;c.position.z=z;animateCharacter(c,{x:0,z,yaw:0,time:frame*dt,attackAt:-100,selected:'hand'},dt,()=>0);c.updateMatrixWorld(true);
      if(frame===fps*2)startPhase=c.userData.phase;
      if(frame>fps*2&&c.userData.footContacts.every(contact=>!contact)){
        for(const ankle of c.userData.ankles)assert.ok(ankle.getWorldPosition(new THREE.Vector3()).y>.145+1e-8);
        flights++;
      }
    }
    assert.ok(Math.abs(c.userData.strideLength-length)<1e-6);assert.ok(Math.abs(c.userData.stanceFraction-stance)<1e-6);
    assert.ok(Math.abs((c.userData.phase-startPhase)/(2*Math.PI)/2-speed/length)<1e-6);
    assert.equal(flights>0,speed>3);
    if(speed>3){assert.ok(c.userData.elbows[0].rotation.x<-.6);assert.ok(c.userData.body.rotation.x>.1);}
  }
});

test('stopping holds the last stride shape while the torso and feet recover',()=>{
  const c=createCharacter(),state={x:0,z:0,yaw:0,time:0,attackAt:-100,selected:'hand'};
  for(let frame=0;frame<=180;frame++){state.z=frame/60*12;state.time=frame/60;c.position.z=state.z;animateCharacter(c,state,1/60,()=>0);}
  const length=c.userData.strideLength,stance=c.userData.stanceFraction;
  for(let frame=0;frame<180;frame++){state.time+=1/60;animateCharacter(c,state,1/60,()=>0);assert.equal(c.userData.strideLength,length);assert.equal(c.userData.stanceFraction,stance);}
  c.updateMatrixWorld(true);assert.ok(Math.abs(c.userData.body.rotation.x)<1e-8);
  for(const ankle of c.userData.ankles){const point=c.worldToLocal(ankle.getWorldPosition(new THREE.Vector3()));assert.ok(Math.abs(point.z)<.14);assert.ok(Math.abs(point.y-.145)<1e-8);}
});
