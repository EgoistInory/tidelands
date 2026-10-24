import * as THREE from '../vendor/three.module.min.js';
import {ATTACK_DURATION,GATHER_DURATION} from './action-timing.js';
import {createTextileMaterial} from './textile.js';
import {createTravelerHead} from './character-head.js';
import {updateBodyMotion} from './body-motion.js';

const fabrics=new Map();
function surface(color,metal=false,cloth=false){const key=`${color}-${metal}-${cloth}`;if(!fabrics.has(key))fabrics.set(key,cloth?createTextileMaterial(color):new THREE.MeshStandardMaterial({color,roughness:metal?.36:.88,metalness:metal?.55:0}));return fabrics.get(key);}
function part(geometry,color,x,y,z,metal=false,cloth=false){const m=new THREE.Mesh(geometry,surface(color,metal,cloth));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
const rounded=(r,length,color,x,y,z,cloth=false)=>part(new THREE.CapsuleGeometry(r,length,5,10),color,x,y,z,false,cloth);
const block=(w,h,d,color,x,y,z,metal=false,cloth=false)=>part(new THREE.BoxGeometry(w,h,d),color,x,y,z,metal,cloth);
// Shaped sections keep cloth volume at the joints instead of pinching each capsule to a point.
function clothShell(name,rings,color,{segments=24,square=1,fold=.025}={}){
  const vertices=[],uv=[],indices=[],columns=segments+1,bottom=rings[0][0],height=rings.at(-1)[0]-bottom;
  for(let row=0;row<rings.length;row++){
    const [y,rx,rz,centerZ=0]=rings[row],t=(y-bottom)/height;
    for(let col=0;col<=segments;col++){
      const a=col/segments*Math.PI*2,s=Math.sin(a),c=Math.cos(a),crease=1+fold*Math.sin(t*Math.PI)*Math.sin(a*5+t*9);
      vertices.push(Math.sign(s)*Math.abs(s)**square*rx*crease,y,centerZ+Math.sign(c)*Math.abs(c)**square*rz*crease);uv.push(col/segments,t);
      if(row<rings.length-1&&col<segments){const i=row*columns+col;indices.push(i,i+1,i+columns,i+1,i+columns+1,i+columns);}
    }
  }
  for(const [row,reverse]of [[0,true],[rings.length-1,false]]){
    const [y,,,z=0]=rings[row],cap=vertices.length/3;vertices.push(0,y,z);uv.push(.5,(y-bottom)/height);
    for(let col=0;col<segments;col++){const a=row*columns+col,b=a+1;indices.push(cap,reverse?b:a,reverse?a:b);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=part(geometry,color,0,0,0,false,true);mesh.name=name;return mesh;
}
function sleeve(radius,length,color,y){
  const half=length/2+radius;
  const mesh=clothShell('tailored-sleeve',[[-half,radius*.89,radius*.82],[-half*.77,radius*.92,radius*.88],[-half*.3,radius*1.03,radius*.97],[half*.35,radius*1.08,radius],[half*.72,radius*.94,radius*.87],[half,radius*.66,radius*.63]],color);
  mesh.position.y=y;return mesh;
}
function shapedPart(points,depth,color,x,y,z,metal=false){
  const shape=new THREE.Shape(points.map(([px,py])=>new THREE.Vector2(px,py)));
  return part(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,steps:1}),color,x,y,z-depth/2,metal);
}

const bootOutline=[[-.105,-.17],[-.145,-.115],[-.15,.14],[-.14,.27],[-.10,.35],[-.04,.385],[.04,.385],[.10,.35],[.14,.27],[.15,.14],[.145,-.115],[.105,-.17]];
function bootShell(rings){
  const vertices=[],indices=[],count=bootOutline.length;
  for(const ring of rings)for(const [x,z] of bootOutline)vertices.push(...ring(x,z));
  for(let level=0;level<rings.length-1;level++)for(let i=0;i<count;i++){
    const a=level*count+i,b=level*count+(i+1)%count,c=b+count,d=a+count;indices.push(a,b,c,a,c,d);
  }
  for(const [level,reverse] of [[0,true],[rings.length-1,false]]){
    const points=vertices.slice(level*count*3,(level+1)*count*3),center=[0,0,0];
    for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++)center[axis]+=points[i*3+axis]/count;
    const cap=vertices.length/3;vertices.push(...center);
    for(let i=0;i<count;i++){const a=level*count+i,b=level*count+(i+1)%count;indices.push(cap,reverse?b:a,reverse?a:b);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function trailBoot(side){
  const boot=new THREE.Group();boot.name='trail-boot';
  const sole=part(bootShell([(x,z)=>[x*.98,-.145,z],(x,z)=>[x*1.02,-.125,z],(x,z)=>[x,-.085,z]]),0x252b28,0,0,0);sole.name='boot-sole';
  const upper=part(bootShell([(x,z)=>[x,-.085,z],(x,z)=>[x*.93,.04+.07*(1-THREE.MathUtils.smoothstep(z,.02,.32)),z],(x,z)=>[x*.72,.22,(z+.17)/.555*.20-.12]]),0x614a36,0,0,0);
  const cuff=part(new THREE.CylinderGeometry(.115,.125,.045,12),0x80654b,0,.20,-.02);cuff.scale.set(.94,1,.85);
  boot.add(sole,upper,cuff,block(.025,.045,.055,0xb29b68,side*.115,.18,-.02,true));return boot;
}

export function createCharacterTools(){
  const tools=new THREE.Group();
  const axe=new THREE.Group();axe.add(rounded(.045,.78,0x6d5136,0,.08,0));
  const blade=shapedPart([[-.05,-.12],[.13,-.10],[.29,-.19],[.40,-.08],[.38,.14],[.25,.21],[.12,.10],[-.05,.10]],.09,0x89928c,0,.43,0);blade.name='axe-head';axe.add(blade,block(.12,.10,.10,0xb4a58a,0,.42,0));tools.add(axe);
  const sword=new THREE.Group();sword.add(rounded(.045,.26,0x514239,0,-.12,0),block(.4,.06,.1,0xb79b5d,0,.08,0,true));
  const swordBlade=shapedPart([[-.12,.12],[-.16,.28],[-.12,1.09],[0,1.40],[.12,1.09],[.16,.28],[.12,.12]],.045,0x8cc9c7,0,0,0,true);swordBlade.name='sword-blade';sword.add(swordBlade);tools.add(sword);
  axe.visible=sword.visible=false;
  return {tools,axe,sword};
}

export function createCharacter(color=0xb86636){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const coatProfile=[[.43,0],[.44,.08],[.42,.28],[.36,.52],[.35,.65],[.42,.79],[.49,.90],[.46,.95],[.30,1.02]].map(([r,y])=>new THREE.Vector2(r,y));
  const coat=clothShell('travel-coat',coatProfile.map(p=>[p.y+1.25,p.x,p.x*.63]),color,{segments:32,fold:.018});body.add(coat);
  const trim=new THREE.Color(color).multiplyScalar(.66).getHex();
  const coatPanel=(points,panelColor)=>{
    const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y))),geometry=new THREE.ShapeGeometry(shape);
    const positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const y=THREE.MathUtils.clamp(positions.getY(i)-1.25,0,1.02);let radius=coatProfile.at(-1).x;
      for(let j=1;j<coatProfile.length;j++)if(y<=coatProfile[j].y){radius=THREE.MathUtils.lerp(coatProfile[j-1].x,coatProfile[j].x,(y-coatProfile[j-1].y)/(coatProfile[j].y-coatProfile[j-1].y));break;}
      positions.setZ(i,Math.sqrt(Math.max(0,radius*radius-positions.getX(i)**2))*.63+.025);
    }
    geometry.computeVertexNormals();body.add(part(geometry,panelColor,0,0,0,false,true));
  };
  for(const side of [-1,1]){
    coatPanel([[side*.10,2.25],[side*.32,2.10],[side*.17,1.96],[side*.05,2.14]],trim);
    coatPanel([[side*.15,1.48],[side*.33,1.45],[side*.32,1.30],[side*.16,1.32]],trim);
  }
  const belt=part(new THREE.LatheGeometry([[.421,-.055],[.428,-.045],[.422,.045],[.414,.055]].map(([r,y])=>new THREE.Vector2(r,y)),32),0x443e32,0,1.55,0);belt.scale.z=.66;
  body.add(belt,block(.13,.10,.04,0xc6aa65,0,1.55,.295,true));
  body.add(rounded(.095,.16,0xc79878,0,2.37,.012));
  body.add(createTravelerHead(color=>surface(color)));
  const scarf=part(new THREE.TorusGeometry(.168,.043,8,24),0xb2b7a1,0,2.34,0,false,true);scarf.rotation.x=Math.PI/2;body.add(scarf);
  coatPanel([[.06,2.30],[.16,2.28],[.13,2.17],[.17,2.03],[.115,1.96],[.058,2.02],[.09,2.16]],0xb2b7a1);
  body.add(clothShell('travel-pack',[[1.57,.17,.08,-.37],[1.61,.25,.13,-.39],[1.74,.29,.16,-.39],[2.10,.28,.17,-.39],[2.23,.23,.14,-.39],[2.28,.15,.09,-.39]],0x555747,{square:.65,fold:.018}));
  const bedroll=part(new THREE.CylinderGeometry(.10,.10,.72,12),0x9e9275,0,2.35,-.40,false,true);bedroll.rotation.z=Math.PI/2;body.add(bedroll);
  for(const x of [-.22,.22]){const binding=part(new THREE.TorusGeometry(.102,.018,6,12),0x514239,x,2.35,-.40);binding.rotation.y=Math.PI/2;body.add(binding);}
  for(const x of [-.24,.24]){
    const vertices=[],indices=[];
    for(let row=0;row<=12;row++){
      const y=THREE.MathUtils.lerp(1.63,2.26,row/12),height=y-1.25;let radius=coatProfile.at(-1).x;
      for(let j=1;j<coatProfile.length;j++)if(height<=coatProfile[j].y){radius=THREE.MathUtils.lerp(coatProfile[j-1].x,coatProfile[j].x,(height-coatProfile[j-1].y)/(coatProfile[j].y-coatProfile[j-1].y));break;}
      for(const edge of [-.029,.029]){const px=x+edge;vertices.push(px,y,Math.sqrt(Math.max(0,radius*radius-px*px))*.63+.032);}
      if(row<12){const a=row*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const strap=part(geometry,0x927955,0,0,0);strap.name='pack-front-strap';body.add(strap);
  }
  const hips=[],knees=[],ankles=[],shoulders=[],elbows=[];
  for(const side of [-1,1]){
    const hip=new THREE.Group();hip.position.set(side*.22,1.28,0);body.add(hip);hips.push(hip);
    hip.add(clothShell('trouser-thigh',[[-.58,.12,.11],[-.51,.126,.119],[-.37,.145,.132,.008],[-.18,.161,.148],[.04,.159,.147]],0x343e3b));
    const knee=new THREE.Group();knee.position.y=-.54;hip.add(knee);knees.push(knee);
    knee.add(clothShell('trouser-shin',[[-.50,.103,.104],[-.41,.113,.115],[-.25,.132,.129,-.008],[-.12,.127,.122],[.04,.12,.11]],0x343e3b));
    const ankle=new THREE.Group();ankle.position.y=-.55;knee.add(ankle);ankles.push(ankle);
    ankle.add(trailBoot(side));
    const shoulder=new THREE.Group();shoulder.position.set(side*.46,2.17,0);body.add(shoulder);shoulders.push(shoulder);
    shoulder.add(sleeve(.135,.27,color,-.20));
    const elbow=new THREE.Group();elbow.position.y=-.43;shoulder.add(elbow);elbows.push(elbow);
    elbow.add(sleeve(.11,.25,color,-.18),rounded(.105,.12,0xc79878,0,-.43,0));
  }
  const {tools,axe,sword}=createCharacterTools();tools.position.set(0,-.46,.04);tools.rotation.z=Math.PI;elbows[1].add(tools);
  root.userData={body,hips,knees,ankles,shoulders,elbows,axe,sword,phase:0,walkBlend:0,lastPosition:null,footfallCount:0};
  animateCharacter(root,{x:0,z:0,yaw:0,time:0,attackAt:-100,selected:'hand'},0);
  root.userData.lastPosition=null;return root;
}

const legLength=.54+.55,down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
function footStep(phase,strideLength,stanceFraction){
  const u=((phase/(Math.PI*2))%1+1)%1,span=strideLength*stanceFraction;
  if(u<stanceFraction)return {z:span/2-strideLength*u,lift:0,stance:true};
  const t=(u-stanceFraction)/(1-stanceFraction),ease=t*t*(3-2*t);
  return {z:-span/2+span*ease,lift:.16*Math.sin(t*Math.PI),stance:false,t};
}

function resetFeet(rig){rig.worldFeet=null;rig.footCycles=null;rig.footContacts=null;rig.swingStarts=null;rig.landingFeet=null;rig.earlyLift=null;rig.idleStep=null;rig.idleTime=0;}
function floorNormal(ground,x,z){return ground?new THREE.Vector3(-(ground(x+.15,z)-ground(x-.15,z))/.3,1,-(ground(x,z+.15)-ground(x,z-.15))/.3).normalize():up.clone();}

function placeFeet(root,ground,time,dt,yaw,crouch=0){
  const rig=root.userData,body=rig.body,strideLength=rig.strideLength,stanceFraction=rig.stanceFraction;
  body.updateMatrix();root.updateMatrixWorld(true);
  const nextTravel=rig.travelDirection.clone().multiplyScalar(rig.stepDistance).applyQuaternion(root.quaternion.clone().invert()),nextTurn=Math.atan2(Math.sin(yaw-root.rotation.y),Math.cos(yaw-root.rotation.y))*(1-Math.exp(-dt*16));
  const contacts=[],cycles=[],swingStarts=rig.swingStarts??[null,null],landingFeet=rig.landingFeet??[null,null],earlyLift=rig.earlyLift??[null,null];
  if(rig.moving){rig.idleTime=0;rig.idleStep=null;}
  else{
    rig.idleTime+=Math.max(0,dt);
    if(rig.idleTime>.22&&rig.worldFeet&&!rig.idleStep){
      const gaps=rig.hips.map((hip,i)=>{const local=root.worldToLocal(rig.worldFeet[i].clone());return Math.hypot(local.x-hip.position.x,local.z);});
      const airborne=rig.footContacts?.findIndex(contact=>!contact),side=airborne>=0&&gaps[airborne]>.14?airborne:gaps[0]>gaps[1]?0:1;
      if(gaps[side]>.14)rig.idleStep={side,from:rig.worldFeet[side].clone(),elapsed:0};
    }
    if(rig.idleStep)rig.idleStep.elapsed=Math.min(.32,rig.idleStep.elapsed+Math.max(0,dt));
  }
  if(rig.idleStep)body.position.x=(rig.idleStep.side?-.04:.04)*Math.sin(rig.idleStep.elapsed/.32*Math.PI);
  const targets=rig.hips.map((hip,i)=>{
    const reachCenter=hip.position.clone().applyQuaternion(body.quaternion).add(body.position);
    const phase=rig.phase+i*Math.PI,cycle=Math.floor(phase/(Math.PI*2)),u=((phase/(Math.PI*2))%1+1)%1;cycles[i]=cycle;
    const step=footStep(rig.phase+i*Math.PI,strideLength,stanceFraction),target=new THREE.Vector3(hip.position.x,0,step.z*rig.walkBlend),world=root.localToWorld(target.clone());
    if(rig.footCycles?.[i]!==cycle){earlyLift[i]=null;swingStarts[i]=null;}
    const landingContact=rig.footCycles?.[i]!==cycle&&step.stance&&landingFeet[i];
    const planted=landingContact||rig.worldFeet?.[i],local=planted?root.worldToLocal(planted.clone()):null;
    // Lift before the next rendered movement/turn makes the planted leg unreachable.
    if(rig.moving&&step.stance&&local&&(landingContact||rig.footCycles?.[i]===cycle)&&earlyLift[i]===null){
      const forecast=local.clone().sub(nextTravel).applyAxisAngle(up,-nextTurn);
      if(ground)forecast.y-=ground(root.position.x+rig.travelDirection.x*rig.stepDistance,root.position.z+rig.travelDirection.z*rig.stepDistance)-root.position.y;
      const supportHeight=point=>point.y+Math.sqrt(Math.max(.01,(legLength-.01)**2-(point.x-reachCenter.x)**2-(point.z-reachCenter.z)**2))-(reachCenter.y-body.position.y);
      // A low planted foot can exhaust vertical reach before reaching the horizontal limit.
      if(Math.max(Math.hypot(local.x-reachCenter.x,local.z-reachCenter.z),Math.hypot(forecast.x-reachCenter.x,forecast.z-reachCenter.z))>.82||Math.min(supportHeight(local),supportHeight(forecast))<-.38)earlyLift[i]=u;
    }
    const stance=step.stance&&earlyLift[i]===null;let lift=step.lift;
    if(planted&&(!rig.moving||(stance&&(landingContact||rig.footCycles?.[i]===cycle)))){
      target.x=local.x;target.z=local.z;world.x=planted.x;world.z=planted.z;
    }else if(planted&&!stance){
      if(!swingStarts[i])swingStarts[i]=planted.clone();
      const t=earlyLift[i]===null?step.t:Math.min(1,(u-earlyLift[i])/(1-earlyLift[i])),ease=t*t*(3-2*t);
      const landing=root.localToWorld(new THREE.Vector3(hip.position.x,0,strideLength*stanceFraction/2));
      landing.addScaledVector(rig.travelDirection,(1-u)*strideLength);
      landingFeet[i]=landing.clone();
      world.copy(swingStarts[i]).lerp(landing,ease);const swingLocal=root.worldToLocal(world.clone());target.x=swingLocal.x;target.z=swingLocal.z;
      lift=.16*Math.sin(t*Math.PI);
    }
    if(earlyLift[i]!==null&&!rig.moving){const t=(u-earlyLift[i])/(1-earlyLift[i]);lift=.16*Math.sin(t*Math.PI);}
    // Bound only airborne targets; grounded contacts keep their world coordinates.
    if(rig.moving&&!stance&&lift>1e-8){
      const dx=target.x-reachCenter.x,dz=target.z-reachCenter.z,span=Math.hypot(dx,dz);
      if(span>.76){target.x=reachCenter.x+dx*.76/span;target.z=reachCenter.z+dz*.76/span;world.copy(root.localToWorld(target.clone()));}
    }
    const normal=floorNormal(ground,world.x,world.z);
    target.y=(ground?ground(world.x,world.z):root.position.y)-root.position.y+.145/normal.y+lift*rig.walkBlend;
    // Shorten downhill airborne steps before forcing the whole body down to reach them.
    if(ground&&rig.moving&&!stance&&lift*rig.walkBlend>1e-8)for(let attempt=0;attempt<12;attempt++){
      const dx=target.x-reachCenter.x,dz=target.z-reachCenter.z;
      const reachablePelvis=target.y+Math.sqrt(Math.max(.01,(legLength-.01)**2-dx*dx-dz*dz))-(reachCenter.y-body.position.y);
      if(reachablePelvis>=-.38)break;
      target.x=THREE.MathUtils.lerp(reachCenter.x,target.x,.85);target.z=THREE.MathUtils.lerp(reachCenter.z,target.z,.85);
      world.copy(root.localToWorld(target.clone()));normal.copy(floorNormal(ground,world.x,world.z));
      target.y=ground(world.x,world.z)-root.position.y+.145/normal.y+lift*rig.walkBlend;
    }
    contacts[i]=stance||lift*rig.walkBlend<1e-8;
    if(rig.idleStep?.side===i){
      const recovery=rig.idleStep,t=recovery.elapsed/.32,ease=t*t*(3-2*t),landing=root.localToWorld(new THREE.Vector3(hip.position.x,0,0));
      world.copy(recovery.from).lerp(landing,ease);const local=root.worldToLocal(world.clone());target.x=local.x;target.z=local.z;
      const height=ground?ground(world.x,world.z):root.position.y,startHeight=ground?ground(recovery.from.x,recovery.from.z):root.position.y;
      normal.copy(floorNormal(ground,world.x,world.z));
      target.y=height-root.position.y+.145/normal.y+.12*Math.sin(t*Math.PI)+Math.max(0,recovery.from.y-startHeight-.145/floorNormal(ground,recovery.from.x,recovery.from.z).y)*(1-ease);
      contacts[i]=t===1;swingStarts[i]=null;landingFeet[i]=null;earlyLift[i]=null;
    }
    return {target,normal:normal.applyQuaternion(root.quaternion.clone().invert())};
  });
  rig.worldFeet=targets.map(({target})=>root.localToWorld(target.clone()));
  rig.footfallCount+=contacts.reduce((count,contact,i)=>count+Number(contact&&rig.footContacts?.[i]===false),0);
  rig.footCycles=cycles;rig.footContacts=contacts;rig.swingStarts=swingStarts;rig.landingFeet=landingFeet;rig.earlyLift=earlyLift;
  if(rig.idleStep?.elapsed===.32)rig.idleStep=null;
  // Let the pelvis follow the reachable height; the boots keep their sole height.
  body.position.y=Math.min(...targets.map(({target},i)=>{
    const hip=rig.hips[i].position.clone().applyQuaternion(body.quaternion),dx=target.x-hip.x-body.position.x,dz=target.z-hip.z-body.position.z;
    return target.y+Math.sqrt(Math.max(.01,(legLength-.01)**2-dx*dx-dz*dz))-hip.y;
  }))-.003*(1+Math.sin(time*1.8))-crouch;
  const inverseBody=body.quaternion.clone().invert();
  for(let i=0;i<2;i++){
    const hip=rig.hips[i],knee=rig.knees[i],ankle=rig.ankles[i];
    const target=targets[i].target.clone().sub(body.position).applyQuaternion(inverseBody).sub(hip.position);
    const distance=THREE.MathUtils.clamp(target.length(),.02,legLength-.0001),direction=target.clone().normalize();
    const pole=new THREE.Vector3(0,0,1).addScaledVector(direction,-direction.z);
    if(pole.lengthSq()<1e-8)pole.set(1,0,0).addScaledVector(direction,-direction.x);
    pole.normalize();
    const along=(.54*.54+distance*distance-.55*.55)/(2*distance),bend=Math.sqrt(Math.max(0,.54*.54-along*along));
    const kneeVector=direction.clone().multiplyScalar(along).addScaledVector(pole,bend);
    hip.quaternion.setFromUnitVectors(down,kneeVector.clone().normalize());
    const shin=direction.multiplyScalar(distance).sub(kneeVector).applyQuaternion(hip.quaternion.clone().invert());
    knee.quaternion.setFromUnitVectors(down,shin.normalize());
    ankle.quaternion.copy(body.quaternion).multiply(hip.quaternion).multiply(knee.quaternion).invert().multiply(new THREE.Quaternion().setFromUnitVectors(up,targets[i].normal));
  }
}

export function animateCharacter(root,{x,z,yaw,time,attackAt,gatherAt=-100,gatherKind=null,gatherTool=null,hurtAt=-100,selected,swimming=false},dt,ground=null){
  const rig=root.userData,last=rig.lastPosition;
  const traveled=last?Math.hypot(x-last.x,z-last.z):0;rig.lastPosition={x,z};
  if(!last)resetFeet(rig);
  rig.travelDirection=traveled>.0001?new THREE.Vector3(x-last.x,0,z-last.z).normalize():(rig.travelDirection??new THREE.Vector3(0,0,1));
  const speed=last&&traveled<=5&&dt>0&&!swimming?Math.min(12,traveled/dt):0;
  if(!last||traveled>5||swimming){rig.speed=0;rig.strideLength=1.6;rig.stanceFraction=.6;}
  rig.speed=(rig.speed??0)+(speed-(rig.speed??0))*(1-Math.exp(-Math.max(0,dt)*10));
  const run=THREE.MathUtils.smoothstep(rig.speed,3,7),sprint=THREE.MathUtils.clamp((rig.speed-7)/5,0,1);
  // Preserve the last step shape while stopped; idle recovery owns the landing.
  const strideLength=rig.strideLength=traveled>.0001?1.6+1.6*run+1.8*sprint:(rig.strideLength??1.6);
  const stanceFraction=rig.stanceFraction=traveled>.0001?.6-.2*run-.14*sprint:(rig.stanceFraction??.6);
  // Distance drives the gait; stance feet stay at their world-space contact points.
  if(traveled>5){rig.phase=0;rig.walkBlend=0;resetFeet(rig);}
  else{
    // Batched key presses can skip a whole swing between rendered frames.
    if(traveled>Math.min(strideLength*(1-stanceFraction),Math.max(.2,dt*16)))resetFeet(rig);
    if(traveled>.0001&&rig.phase===0)rig.phase=.3*Math.PI*2;
    rig.phase+=traveled*Math.PI*2/strideLength;
  }
  const moving=traveled>.0001;
  rig.moving=moving&&!swimming;rig.stepDistance=traveled;
  if(swimming)resetFeet(rig);
  rig.walkBlend+=(Number(moving&&!swimming)-rig.walkBlend)*(1-Math.exp(-Math.max(0,dt)*12));
  const gait=swimming?Math.sin(time*5)*.4:Math.sin(rig.phase)*.55*rig.walkBlend;
  root.rotation.y+=Math.atan2(Math.sin(yaw-root.rotation.y),Math.cos(yaw-root.rotation.y))*(1-Math.exp(-dt*16));
  const motion=updateBodyMotion(rig,x,z,root.rotation.y,dt,!last||traveled>5||swimming);
  rig.body.position.x=0;
  rig.body.position.y=swimming?Math.sin(time*1.8)*.013:0;
  rig.body.rotation.x=swimming?1.25:.12*run*rig.walkBlend+.04*motion.drive;
  rig.body.rotation.y=swimming?0:.08*motion.turn;
  for(let i=0;i<2;i++){
    const stride=i?gait:-gait;rig.hips[i].rotation.x=stride;rig.knees[i].rotation.x=Math.max(0,-stride)*1.1;
    rig.shoulders[i].rotation.x=swimming?Math.sin(time*5+i*Math.PI)*.8-1:-stride*(.7+.5*run);
    rig.shoulders[i].rotation.z=0;
    rig.elbows[i].rotation.x=-.15-.5*run*rig.walkBlend-Math.max(0,stride)*.35;
    rig.ankles[i].quaternion.identity();
  }
  if(!swimming&&selected==='sword'){rig.shoulders[1].rotation.x-=.35*(1-.3*rig.walkBlend);rig.elbows[1].rotation.x-=.33;}
  const attackTime=time-attackAt;let crouch=0,equipped=selected;
  if(attackTime>=0&&attackTime<ATTACK_DURATION){
    const swing=Math.sin(attackTime/ATTACK_DURATION*Math.PI);
    rig.shoulders[1].rotation.x=THREE.MathUtils.lerp(rig.shoulders[1].rotation.x,selected==='axe'?-.4:-.8,swing);
    rig.elbows[1].rotation.x=THREE.MathUtils.lerp(rig.elbows[1].rotation.x,-.25,swing);
    if(!swimming){
      rig.body.rotation.y=THREE.MathUtils.lerp(rig.body.rotation.y,.22,swing);
      rig.shoulders[0].rotation.x=THREE.MathUtils.lerp(rig.shoulders[0].rotation.x,-.5,swing);
      rig.shoulders[0].rotation.z=-.18*swing;
      rig.elbows[0].rotation.x=THREE.MathUtils.lerp(rig.elbows[0].rotation.x,-.45,swing);
    }
  }
  else if(!swimming&&time>=gatherAt&&time-gatherAt<GATHER_DURATION){
    const reach=Math.sin((time-gatherAt)/GATHER_DURATION*Math.PI);
    const low=['berry','fiber','shell'].includes(gatherKind),shell=gatherKind==='shell';
    equipped=low?'hand':(gatherTool??selected);
    crouch=low?(shell?.5:.35)*reach:0;
    rig.body.rotation.x=THREE.MathUtils.lerp(rig.body.rotation.x,low?(shell?.6:.44):.16,reach);
    rig.shoulders[1].rotation.x=THREE.MathUtils.lerp(rig.shoulders[1].rotation.x,equipped==='sword'?-.8:-.55,reach);
    rig.elbows[1].rotation.x=THREE.MathUtils.lerp(rig.elbows[1].rotation.x,-.25,reach);
    rig.body.rotation.y=THREE.MathUtils.lerp(rig.body.rotation.y,-.14,reach);
    rig.shoulders[0].rotation.x=THREE.MathUtils.lerp(rig.shoulders[0].rotation.x,-.35,reach);
    rig.shoulders[0].rotation.z=-.12*reach;
    rig.elbows[0].rotation.x=THREE.MathUtils.lerp(rig.elbows[0].rotation.x,-.35,reach);
  }
  // Recoil affects the rig only; collisions and player movement remain authoritative.
  const hurtAge=time-hurtAt,hurt=hurtAge>=0&&hurtAge<.3?1-hurtAge/.3:0;
  rig.body.position.z=-.12*hurt;
  rig.body.rotation.x-=.18*hurt;
  rig.body.rotation.z=.08*hurt-(swimming?0:.10*motion.turn*Math.min(1,rig.speed/3));
  if(!swimming)placeFeet(root,ground,time,dt,yaw,crouch);
  rig.axe.visible=equipped==='axe';rig.sword.visible=equipped==='sword';
}
