import * as THREE from '../vendor/three.module.min.js';
import {updateBodyMotion} from './body-motion.js';
import {ENEMY_ATTACK_DURATION,ENEMY_ATTACK_IMPACT} from './action-timing.js';
import {mergeStaticParts} from './merge-parts.js';
import {placeCreatureFeet,resetCreatureFeet} from './creature-footing.js';
import {acquireCreatureSurface} from './creature-surface.js';

function profiledHide(sections){
  const vertices=[],uv=[],indices=[],sides=24;
  for(let j=0;j<sections.length;j++){
    const [z,y,width,height]=sections[j];
    for(let i=0;i<=sides;i++){
      const a=i/sides*Math.PI*2;vertices.push(Math.cos(a)*width,y+Math.sin(a)*height,z);uv.push(i/sides,j/(sections.length-1));
      if(j&&i){const b=j*(sides+1)+i,a=b-1,c=a-sides-1,d=b-sides-1;indices.push(a,c,b,b,c,d);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function taperedCurve(points,radius,tip=.04,sides=8){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments=16;
  const geometry=new THREE.TubeGeometry(curve,segments,radius,sides,false),position=geometry.attributes.position;
  for(let j=0;j<=segments;j++){
    const center=curve.getPointAt(j/segments),scale=1-(1-tip)*j/segments;
    for(let i=0;i<=sides;i++){const k=j*(sides+1)+i,p=new THREE.Vector3().fromBufferAttribute(position,k).sub(center).multiplyScalar(scale).add(center);position.setXYZ(k,p.x,p.y,p.z);}
  }
  geometry.computeVertexNormals();return geometry;
}

// Each creature owns its materials so hit feedback never changes its neighbours.
export function createCreature(type,geometryCache=null){
  const root=new THREE.Group(),ground=new THREE.Group(),body=new THREE.Group(),legs=[],claws=[];
  const surface=acquireCreatureSurface(type,geometryCache),hide=surface.material;
  const dark=new THREE.MeshStandardMaterial({color:0x302b27,roughness:.8});
  const ivory=new THREE.MeshStandardMaterial({color:0xe7d6ad,roughness:.7});
  const form=(parent,geometry,mat=hide)=>{
    const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const shape=(parent,scale,position,mat=hide)=>{
    const mesh=form(parent,new THREE.SphereGeometry(1,16,12),mat);
    mesh.scale.set(...scale);mesh.position.set(...position);return mesh;
  };
  root.add(ground);ground.add(body);
  if(type==='crab'){
    form(body,profiledHide([[-.86,.69,0,0],[-.74,.71,.58,.15],[-.45,.74,.97,.29],[0,.77,1.07,.34],[.42,.77,.93,.29],[.72,.72,.66,.17],[.8,.69,0,0]]));
    shape(body,[.93,.13,.69],[0,.51,0],dark);
    const rim=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;rim.push(new THREE.Vector3(Math.cos(a)*1.03,.65,Math.sin(a)*.77));}
    form(body,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim),64,.035,6,false),hide);
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const z=-.45+i*.2,x=side*(.95+Math.sin(i/4*Math.PI)*.11),g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute([x,.7,z-.1,x,.81,z, x+side*.18,.72,z+.035,x,.66,z+.11],3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,.5,1,1,.5,1,0],2));g.setIndex([0,1,2,0,2,3,0,3,1,1,3,2]);g.computeVertexNormals();form(body,g);
    }
    for(const side of [-1,1]){
      for(let i=0;i<4;i++){
        const joint=new THREE.Group();joint.position.set(side*.76,.66,(i-1.5)*.38);body.add(joint);
        const spread=(i-1.5)*.22;
        form(joint,taperedCurve([[0,0,0],[side*.48,.06,spread],[side*.85,-.13,spread*1.5]],.105,.5));
        const knee=new THREE.Group();knee.position.set(side*.85,-.13,spread*1.5);joint.add(knee);
        form(knee,taperedCurve([[-side*.01,0,0],[side*.17,-.26,spread*.2],[side*.12,-.49,spread*.4]],.075));
        joint.userData={knee,foot:new THREE.Vector3(side*.12,-.49,spread*.4)};legs.push(joint);
      }
      const claw=new THREE.Group();claw.position.set(side*.8,.75,.65);body.add(claw);
      form(claw,taperedCurve([[0,0,0],[side*.26,-.1,.23],[side*.24,0,.46]],.12,.85));
      shape(claw,[.25,.18,.32],[side*.24,0,.46]);
      form(claw,taperedCurve([[side*.27,-.035,.63],[side*.15,-.01,.98],[side*.22,-.01,1.11]],.09));
      const pincer=new THREE.Group();pincer.position.set(side*.41,0,.64);claw.add(pincer);
      form(pincer,taperedCurve([[0,0,0],[side*.16,.04,.3],[side*.02,0,.47]],.095));
      claw.userData={side,pincer};claws.push(claw);
      if(side===1)claw.scale.setScalar(1.12);
      shape(body,[.045,.19,.045],[side*.4,1.05,.5],dark);
      shape(body,[.10,.105,.10],[side*.4,1.24,.5],dark);
      shape(body,[.028,.025,.03],[side*.4-.025,1.27,.583],ivory);
    }
  }else{
    form(body,profiledHide([[-1.4,1.27,0,0],[-1.21,1.25,.43,.46],[-.9,1.27,.63,.59],[-.48,1.30,.73,.67],[0,1.38,.78,.78],[.42,1.44,.74,.82],[.73,1.39,.60,.71],[1.03,1.29,.46,.49],[1.40,1.15,.38,.32],[1.67,1.02,.30,.23],[1.93,1,.28,.20],[1.95,1,0,0]]));
    shape(body,[.285,.205,.065],[0,1,1.935],dark);
    for(const side of [-1,1]){
      const earOutline=new THREE.Shape();earOutline.moveTo(-.13,0);earOutline.quadraticCurveTo(-.24,.22,0,.48);earOutline.quadraticCurveTo(.25,.19,.13,0);earOutline.closePath();
      const ear=form(body,new THREE.ExtrudeGeometry(earOutline,{depth:.055,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1,curveSegments:8}));ear.position.set(side*.32,1.6,.98);ear.rotation.set(-.32,side*.45,-side*.37);
      shape(body,[.07,.065,.06],[side*.36,1.4,1.30],dark);
      shape(body,[.038,.05,.022],[side*.12,1.03,1.995],hide);
      form(body,taperedCurve([[side*.30,.89,1.69],[side*.40,.94,1.82],[side*.45,1.13,1.91],[side*.41,1.32,1.88]],.085),ivory);
      for(const z of [-.8,.8]){
        const joint=new THREE.Group();joint.position.set(side*.53,.95,z);body.add(joint);
        const knee=new THREE.Group();knee.position.set(0,-.48,-.12);joint.add(knee);
        form(joint,taperedCurve([[0,.11,.025],[0,-.22,-.06],[0,-.48,-.12]],.22,.55,12));
        form(knee,taperedCurve([[0,.05,-.02],[0,-.22,.08],[0,-.44,.16]],.14,.62,12));
        const ankle=new THREE.Group();ankle.position.set(0,-.44,.16);knee.add(ankle);shape(ankle,[.2,.16,.26],[0,.16,0],dark);
        joint.userData={knee,ankle,foot:ankle.position.clone()};legs.push(joint);
      }
    }
    form(body,profiledHide([[-1.06,1.87,0,0],[-.84,1.95,.065,.10],[-.5,2.06,.07,.16],[0,2.18,.075,.19],[.44,2.23,.085,.22],[.73,2.04,.065,.16],[.94,1.88,0,0]]),dark);
    form(body,taperedCurve([[0,1.44,-1.24],[.07,1.35,-1.56],[.21,1.55,-1.68],[.15,1.65,-1.57]],.065),dark);
  }
  mergeStaticParts(body);
  for(const joint of [...legs,...claws])mergeStaticParts(joint);
  // Distant creatures keep their full silhouette, baked into one mesh per material.
  const distant=new THREE.Group(),surfaces=[hide,dark,ivory];let cached=geometryCache?.get(type);
  const nearMeshes=[];body.traverse(part=>{if(part.isMesh)nearMeshes.push(part);});
  if(cached){
    // Only immutable vertex/index data is shared; each rig and material stays private.
    const generated=new Set(nearMeshes.map(mesh=>mesh.geometry));
    nearMeshes.forEach((mesh,i)=>{mesh.geometry=cached.nearParts[i];});
    generated.forEach(geometry=>geometry.dispose());
    for(const {geometry,slot} of cached.parts){const mesh=new THREE.Mesh(geometry,surfaces[slot]);mesh.castShadow=mesh.receiveShadow=true;distant.add(mesh);}
  }else{
    body.updateMatrixWorld(true);
    body.traverse(part=>{if(part.isMesh){const mesh=new THREE.Mesh(part.geometry.clone().applyMatrix4(part.matrixWorld),part.material);mesh.castShadow=mesh.receiveShadow=true;distant.add(mesh);}});
    mergeStaticParts(distant);
    if(geometryCache){cached={references:0,nearParts:nearMeshes.map(mesh=>mesh.geometry),parts:distant.children.map(mesh=>({geometry:mesh.geometry,slot:surfaces.indexOf(mesh.material)}))};geometryCache.set(type,cached);}
  }
  let releaseDistant;
  if(cached){
    cached.references++;let released=false;const geometries=new Set([...cached.nearParts,...cached.parts.map(p=>p.geometry)]);
    releaseDistant=()=>{if(!released){released=true;if(--cached.references===0){geometries.forEach(g=>g.dispose());geometryCache.delete(type);}}return geometries;};
  }
  const contacts=legs.map(hip=>{
    const {knee,ankle,foot}=hip.userData,upper=knee.position.clone(),lower=foot.clone(),end=upper.clone().add(lower);
    const pole=upper.clone().addScaledVector(end,-upper.dot(end)/end.lengthSq()).normalize();
    return {hip,knee,ankle,upper,lower,pole,rest:hip.position.clone().add(end),leg:ankle??knee,point:ankle?new THREE.Vector3():lower.clone()};
  });
  distant.visible=false;ground.add(distant);
  root.userData={type,ground,contacts,body,distant,releaseDistant,releaseSurface:surface.release,far:false,legs,claws,hide,phase:0,last:null,hp:null,hitAt:-100,deadAt:null};
  resetCreatureFeet(root.userData);
  return root;
}

export function resetCreature(root){
  const u=root.userData;
  Object.assign(u,{phase:0,last:null,hp:null,hitAt:-100,deadAt:null,far:false,bodyMotion:null});
  root.position.set(0,0,0);root.rotation.set(0,0,0);root.visible=true;
  u.ground.position.set(0,0,0);u.ground.quaternion.identity();
  for(const g of [u.body,u.distant]){g.position.set(0,0,0);g.rotation.set(0,0,0);}
  u.body.visible=true;u.distant.visible=false;u.hide.emissive.setRGB(0,0,0);
  for(const g of [...u.legs,...u.claws])g.rotation.set(0,0,0);
  for(const c of u.contacts){c.knee.quaternion.identity();c.ankle?.quaternion.identity();}resetCreatureFeet(u);
  for(const claw of u.claws)claw.userData.pincer.rotation.set(0,0,0);
}

export function animateCreature(root,enemy,time,dt,height,target,attackPose=undefined,heightAt=null){
  const u=root.userData,last=u.last;
  const revived=u.hp!==null&&u.hp<=0&&enemy.hp>0;
  if(u.hp!==null&&enemy.hp<u.hp)u.hitAt=time;
  if(enemy.hp<=0&&u.deadAt===null)u.deadAt=u.hp===null?time-.5:time;
  if(enemy.hp>0)u.deadAt=null;
  const distance=last?Math.hypot(enemy.x-last.x,enemy.z-last.z):0;
  const moving=distance>.0001&&distance<4;
  if(!last||distance>=4||enemy.hp<=0||u.deadAt!==null)resetCreatureFeet(u);
  if(moving)u.phase+=distance*Math.PI*2/(u.type==='crab'?1.05:1.5);
  if(moving||Math.hypot(target.x-enemy.x,target.z-enemy.z)<15){
    const angle=attackPose?.yaw??(moving?Math.atan2(enemy.x-last.x,enemy.z-last.z):Math.atan2(target.x-enemy.x,target.z-enemy.z));
    const delta=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y));root.rotation.y+=delta*(1-Math.exp(-dt*10));
  }
  const attackAt=attackPose===undefined?enemy.attackAt:attackPose?.at;
  const motion=updateBodyMotion(u,enemy.x,enemy.z,root.rotation.y,dt,!last||distance>=4||enemy.hp<=0||revived);
  const attackAge=time-(attackAt??-100),attack=attackAge>=0&&attackAge<ENEMY_ATTACK_DURATION?Math.sin(attackAge/ENEMY_ATTACK_DURATION*Math.PI):0;
  // Raise before the blow, then extend toward the target at the actual damage time.
  const clawPitch=attackAge<0||attackAge>=ENEMY_ATTACK_DURATION?0:attackAge<ENEMY_ATTACK_IMPACT/2?
    -.9*THREE.MathUtils.smootherstep(attackAge,0,ENEMY_ATTACK_IMPACT/2):attackAge<ENEMY_ATTACK_IMPACT?
    THREE.MathUtils.lerp(-.9,.1,THREE.MathUtils.smootherstep(attackAge,ENEMY_ATTACK_IMPACT/2,ENEMY_ATTACK_IMPACT)):
    .1*(1-THREE.MathUtils.smootherstep(attackAge,ENEMY_ATTACK_IMPACT,ENEMY_ATTACK_DURATION));
  const hurt=Math.max(0,1-(time-u.hitAt)/.24),death=u.deadAt===null?0:Math.min(1,Math.max(0,(time-u.deadAt)/.5));
  u.legs.forEach((leg,i)=>{const stride=moving?Math.sin(u.phase+(i%2)*Math.PI)*.55:0;leg.rotation.x=u.type==='boar'?stride:0;leg.rotation.z=u.type==='crab'?stride*.45:0;});
  u.claws.forEach((claw,i)=>{claw.rotation.x=clawPitch;claw.rotation.y=(i?1:-1)*attack*.12;claw.userData.pincer.rotation.y=-claw.userData.side*attack*.43;});
  u.body.position.y=(moving?Math.abs(Math.sin(u.phase))*.07:Math.sin(time*2)*.015)-death*.45;
  u.body.position.z=attack*.22-hurt*.18;u.body.rotation.x=(u.type==='boar'?-attack*.18:0)+(u.type==='boar'?.035:.02)*motion.drive;
  u.body.rotation.y=.05*motion.turn;u.body.rotation.z=death*1.3+hurt*.1-(u.type==='boar'?.07:.045)*motion.turn*Math.min(1,motion.speed/2.5);
  const range=Math.hypot(target.x-enemy.x,target.z-enemy.z);
  if(range>120)u.far=true;else if(range<100)u.far=false;
  // Combat and any actual travel always use animated limbs, even at a distance.
  const distant=u.far&&!moving&&attack===0&&hurt===0&&death===0;
  u.body.visible=!distant;u.distant.visible=distant;
  u.distant.position.copy(u.body.position);u.distant.rotation.copy(u.body.rotation);
  u.hide.emissive.setRGB(hurt*.28,hurt*.045,hurt*.015);
  root.position.set(enemy.x,height,enemy.z);root.visible=death<1;
  u.ground.position.y=0;u.ground.quaternion.identity();
  if(heightAt&&death===0&&enemy.hp>0){
    const c=Math.cos(root.rotation.y),s=Math.sin(root.rotation.y);
    const sx=(heightAt(enemy.x+c,enemy.z-s)-heightAt(enemy.x-c,enemy.z+s))/2;
    const sz=(heightAt(enemy.x+s,enemy.z+c)-heightAt(enemy.x-s,enemy.z-c))/2;
    const normal=new THREE.Vector3(-sx,1,-sz).normalize(),tilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
    const angle=2*Math.acos(THREE.MathUtils.clamp(tilt.w,-1,1));
    if(angle>.65)tilt.slerp(new THREE.Quaternion(),1-.65/angle);
    u.ground.quaternion.copy(tilt);root.updateMatrixWorld(true);
    if(!distant){
      u.ground.position.y=u.type==='boar'?-.16:-.04;
      placeCreatureFeet(root,heightAt,dt,moving);
    }else{
      resetCreatureFeet(u);for(const c of u.contacts){c.hip.quaternion.identity();c.knee.quaternion.identity();c.ankle?.quaternion.identity();}root.updateMatrixWorld(true);let lift=-Infinity;
      for(const c of u.contacts){const foot=c.point.clone().applyMatrix4(c.leg.matrixWorld);lift=Math.max(lift,heightAt(foot.x,foot.z)-foot.y);}
      u.ground.position.y=THREE.MathUtils.clamp(lift,-.6,.6);
    }
  }
  u.last={x:enemy.x,z:enemy.z};u.hp=enemy.hp;
}
