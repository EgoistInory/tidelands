import * as THREE from '../vendor/three.module.min.js';
import {mergeStaticParts} from './merge-parts.js';

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

function taperedCurve(points,radius,tip=.04){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments=16,sides=8;
  const geometry=new THREE.TubeGeometry(curve,segments,radius,sides,false),position=geometry.attributes.position;
  for(let j=0;j<=segments;j++){
    const center=curve.getPointAt(j/segments),scale=1-(1-tip)*j/segments;
    for(let i=0;i<=sides;i++){const k=j*(sides+1)+i,p=new THREE.Vector3().fromBufferAttribute(position,k).sub(center).multiplyScalar(scale).add(center);position.setXYZ(k,p.x,p.y,p.z);}
  }
  geometry.computeVertexNormals();return geometry;
}

// Each creature owns its materials so hit feedback never changes its neighbours.
export function createCreature(type,geometryCache=null){
  const root=new THREE.Group(),body=new THREE.Group(),legs=[],claws=[];
  const hide=new THREE.MeshStandardMaterial({color:type==='crab'?0x9f5037:0x675444,roughness:type==='crab'?.68:.95});
  const dark=new THREE.MeshStandardMaterial({color:0x302b27,roughness:.8});
  const ivory=new THREE.MeshStandardMaterial({color:0xe7d6ad,roughness:.7});
  const form=(parent,geometry,mat=hide)=>{
    const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const shape=(parent,scale,position,mat=hide)=>{
    const mesh=form(parent,new THREE.SphereGeometry(1,16,12),mat);
    mesh.scale.set(...scale);mesh.position.set(...position);return mesh;
  };
  root.add(body);
  if(type==='crab'){
    form(body,profiledHide([[-.86,.69,0,0],[-.74,.71,.58,.15],[-.45,.74,.97,.29],[0,.77,1.07,.34],[.42,.77,.93,.29],[.72,.72,.66,.17],[.8,.69,0,0]]));
    shape(body,[.93,.13,.69],[0,.51,0],dark);
    const rim=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;rim.push(new THREE.Vector3(Math.cos(a)*1.03,.65,Math.sin(a)*.77));}
    form(body,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim),64,.035,6,false),ivory);
    for(const side of [-1,1]){
      for(let i=0;i<4;i++){
        const joint=new THREE.Group();joint.position.set(side*.76,.66,(i-1.5)*.38);body.add(joint);
        const spread=(i-1.5)*.22;
        form(joint,taperedCurve([[0,0,0],[side*.48,.06,spread],[side*.85,-.13,spread*1.5]],.105,.5));
        form(joint,taperedCurve([[side*.84,-.13,spread*1.5],[side*1.02,-.39,spread*1.7],[side*.97,-.62,spread*1.9]],.075));legs.push(joint);
      }
      const claw=new THREE.Group();claw.position.set(side*.8,.75,.65);body.add(claw);
      form(claw,taperedCurve([[0,0,0],[side*.26,-.1,.23],[side*.24,0,.46]],.12,.85));
      shape(claw,[.25,.18,.32],[side*.24,0,.46]);
      form(claw,taperedCurve([[side*.27,-.035,.63],[side*.15,-.01,.98],[side*.22,-.01,1.11]],.09));
      const pincer=new THREE.Group();pincer.position.set(side*.41,0,.64);claw.add(pincer);
      form(pincer,taperedCurve([[0,0,0],[side*.16,.04,.3],[side*.02,0,.47]],.095));
      claw.userData={side,pincer};claws.push(claw);
      shape(body,[.045,.19,.045],[side*.4,1.05,.5],dark);
      shape(body,[.10,.105,.10],[side*.4,1.24,.5],dark);
      shape(body,[.028,.025,.03],[side*.4-.025,1.27,.583],ivory);
    }
  }else{
    form(body,profiledHide([[-1.4,1.27,0,0],[-1.21,1.25,.46,.48],[-.9,1.27,.68,.64],[-.48,1.30,.79,.70],[0,1.36,.80,.78],[.42,1.42,.74,.81],[.73,1.37,.61,.70],[1.03,1.29,.41,.48],[1.23,1.24,0,0]]));
    form(body,profiledHide([[.76,1.32,0,0],[.87,1.31,.49,.48],[1.13,1.28,.52,.47],[1.40,1.15,.42,.33],[1.67,1.02,.32,.23],[1.93,1.00,.28,.20],[1.95,1.00,0,0]]));
    shape(body,[.285,.205,.065],[0,1,1.935],dark);
    for(const side of [-1,1]){
      const earOutline=new THREE.Shape();earOutline.moveTo(-.13,0);earOutline.quadraticCurveTo(-.24,.22,0,.48);earOutline.quadraticCurveTo(.25,.19,.13,0);earOutline.closePath();
      const ear=form(body,new THREE.ExtrudeGeometry(earOutline,{depth:.055,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1,curveSegments:8}));ear.position.set(side*.40,1.74,1.06);ear.rotation.set(-.32,side*.45,-side*.37);
      shape(body,[.07,.065,.06],[side*.45,1.45,1.38],dark);
      shape(body,[.038,.05,.022],[side*.12,1.03,1.995],hide);
      form(body,taperedCurve([[side*.30,.89,1.69],[side*.40,.94,1.82],[side*.45,1.13,1.91],[side*.41,1.32,1.88]],.085),ivory);
      for(const z of [-.8,.8]){
        const joint=new THREE.Group();joint.position.set(side*.53,.95,z);body.add(joint);
        shape(joint,[.19,.39,.2],[0,-.31,0]);shape(joint,[.2,.16,.26],[0,-.76,.04],dark);legs.push(joint);
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
  distant.visible=false;root.add(distant);
  root.userData={type,body,distant,releaseDistant,far:false,legs,claws,hide,phase:0,last:null,hp:null,hitAt:-100,deadAt:null};
  return root;
}

export function resetCreature(root){
  const u=root.userData;
  Object.assign(u,{phase:0,last:null,hp:null,hitAt:-100,deadAt:null,far:false});
  root.position.set(0,0,0);root.rotation.set(0,0,0);root.visible=true;
  for(const g of [u.body,u.distant]){g.position.set(0,0,0);g.rotation.set(0,0,0);}
  u.body.visible=true;u.distant.visible=false;u.hide.emissive.setRGB(0,0,0);
  for(const g of [...u.legs,...u.claws])g.rotation.set(0,0,0);
  for(const claw of u.claws)claw.userData.pincer.rotation.set(0,0,0);
}

export function animateCreature(root,enemy,time,dt,height,target){
  const u=root.userData,last=u.last;
  if(u.hp!==null&&enemy.hp<u.hp)u.hitAt=time;
  if(enemy.hp<=0&&u.deadAt===null)u.deadAt=u.hp===null?time-.5:time;
  if(enemy.hp>0)u.deadAt=null;
  const distance=last?Math.hypot(enemy.x-last.x,enemy.z-last.z):0;
  const moving=distance>.0001&&distance<4;
  if(moving)u.phase+=distance*(u.type==='crab'?5:3.2);
  if(moving||Math.hypot(target.x-enemy.x,target.z-enemy.z)<15){
    const angle=moving?Math.atan2(enemy.x-last.x,enemy.z-last.z):Math.atan2(target.x-enemy.x,target.z-enemy.z);
    const delta=Math.atan2(Math.sin(angle-root.rotation.y),Math.cos(angle-root.rotation.y));root.rotation.y+=delta*(1-Math.exp(-dt*10));
  }
  const attackAge=time-(enemy.attackAt??-100),attack=attackAge>=0&&attackAge<.35?Math.sin(attackAge/.35*Math.PI):0;
  const hurt=Math.max(0,1-(time-u.hitAt)/.24),death=u.deadAt===null?0:Math.min(1,Math.max(0,(time-u.deadAt)/.5));
  u.legs.forEach((leg,i)=>{const stride=moving?Math.sin(u.phase+(i%2)*Math.PI)*.55:0;leg.rotation.x=u.type==='boar'?stride:0;leg.rotation.z=u.type==='crab'?stride*.45:0;});
  u.claws.forEach((claw,i)=>{claw.rotation.x=-attack*.9;claw.rotation.y=(i?1:-1)*attack*.35;claw.userData.pincer.rotation.y=-claw.userData.side*attack*.43;});
  u.body.position.y=(moving?Math.abs(Math.sin(u.phase))*.07:Math.sin(time*2)*.015)-death*.45;
  u.body.position.z=attack*.22-hurt*.18;u.body.rotation.x=u.type==='boar'?-attack*.18:0;u.body.rotation.z=death*1.3+hurt*.1;
  const range=Math.hypot(target.x-enemy.x,target.z-enemy.z);
  if(range>120)u.far=true;else if(range<100)u.far=false;
  // Combat and any actual travel always use animated limbs, even at a distance.
  const distant=u.far&&!moving&&attack===0&&hurt===0&&death===0;
  u.body.visible=!distant;u.distant.visible=distant;
  u.distant.position.copy(u.body.position);u.distant.rotation.copy(u.body.rotation);
  u.hide.emissive.setRGB(hurt*.28,hurt*.045,hurt*.015);
  root.position.set(enemy.x,height,enemy.z);root.visible=death<1;
  u.last={x:enemy.x,z:enemy.z};u.hp=enemy.hp;
}
