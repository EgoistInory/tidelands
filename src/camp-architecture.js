import * as THREE from '../vendor/three.module.min.js';
import {createTextileMaterial} from './textile.js';
import {createFlame} from './campfire.js';
import {acquireCampSurface} from './camp-surface.js';

function timberGeometry(w,h,d){
  const r=Math.min(.035,w*.12,h*.12,d*.12),shape=new THREE.Shape();
  shape.moveTo(-w/2+r,-h/2+r);shape.lineTo(w/2-r,-h/2+r);shape.lineTo(w/2-r,h/2-r);shape.lineTo(-w/2+r,h/2-r);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2});geo.translate(0,0,-d/2+r);return geo;
}
export function createCampBuilding(type,cache=new Map(),{surfaces=true,clothMaterial=null,ashMaterial=null}={}){
  cache??=new Map();const root=new THREE.Group(),handles=new Map(),plain=new Map();
  const surface=kind=>{if(!surfaces){if(!plain.has(kind))plain.set(kind,new THREE.MeshStandardMaterial({color:kind==='wood'?0x92734d:kind==='char'?0x302e28:0x777c70,roughness:1}));return plain.get(kind);}if(!handles.has(kind))handles.set(kind,acquireCampSurface(kind,cache));return handles.get(kind).material;};
  const solid=color=>{if(!plain.has(color))plain.set(color,new THREE.MeshStandardMaterial({color,roughness:.86}));return plain.get(color);};
  const add=(geometry,material,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
  const board=(w,h,d,x=0,y=0,z=0)=>add(timberGeometry(w,h,d),surface('wood'),x,y,z);
  const panel=(geometry,material)=>{
    if(geometry.index){const expanded=geometry.toNonIndexed();geometry.dispose();geometry=expanded;}
    const p=geometry.attributes.position,uv=[];
    for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2),along=b.clone().sub(a).normalize(),normal=along.clone().cross(c.clone().sub(a)).normalize(),across=normal.clone().cross(along);for(const point of [a,b,c]){const delta=point.clone().sub(a);uv.push(delta.dot(along),delta.dot(across));}}
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return add(geometry,material);
  };
  const beam=(from,to,r,material)=>{const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);const mesh=add(new THREE.CylinderGeometry(r,r,delta.length(),10),material);mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;};
  if(type==='campfire'){
    const ash=add(new THREE.CylinderGeometry(.91,.98,.07,24),ashMaterial??surface('char'),0,.035,0);
    for(let i=0;i<8;i++){
      const a=i/4*Math.PI,geo=new THREE.IcosahedronGeometry(.31,2),p=geo.attributes.position;
      for(let v=0;v<p.count;v++){const f=1+.07*Math.sin(p.getX(v)*21+p.getY(v)*13+p.getZ(v)*17+i);p.setXYZ(v,p.getX(v)*f,p.getY(v)*f,p.getZ(v)*f);}geo.computeVertexNormals();
      const stone=add(geo,surface('stone'),Math.cos(a)*1.1,.19,Math.sin(a)*1.1);stone.scale.set(1.1,.72,1.04);stone.rotation.y=i*.7;
    }
    for(let i=0;i<3;i++){
      const log=add(new THREE.CylinderGeometry(.14,.18,1.62,16,3),surface('char'),0,.22+i*.09,0);log.rotation.z=Math.PI/2;log.rotation.y=i*1.05+.35;
      for(const end of [-1,1]){const cap=add(new THREE.CircleGeometry(.135,16),surface('wood'));cap.position.set(Math.cos(log.rotation.y)*.811*end,log.position.y,-Math.sin(log.rotation.y)*.811*end);cap.rotation.y=log.rotation.y+(end>0?Math.PI/2:-Math.PI/2);}
    }
    const ember=solid(0x5c2413);ember.emissive.set(0xcc3712);ember.emissiveIntensity=.5;
    for(let i=0;i<9;i++){const coal=add(new THREE.IcosahedronGeometry(.11,1),ember,Math.cos(i*2.4)*.55,.12,Math.sin(i*2.4)*.55);coal.scale.y=.55;}
    const flame=createFlame();root.add(flame);root.userData.flame=flame;ash.receiveShadow=true;
  }else if(type==='tent'){
    const cloth=clothMaterial??createTextileMaterial(0xb9a77c,{side:THREE.DoubleSide,roughness:1}),seam=solid(0xd9c8a2),rope=solid(0xb9a581);
    const height=(t,z)=>2.85*(1-t)+.18*t-.18*Math.sin(t*Math.PI)*(.85+.15*Math.cos(z*1.9));
    for(const side of [-1,1]){
      const points=[],uv=[],indices=[],width=8,length=12;
      for(let iz=0;iz<=length;iz++)for(let ix=0;ix<=width;ix++){const t=ix/width,z=-1.65+iz/length*3.3;points.push(side*1.6*t,height(t,z),z);uv.push(t*3,z+1.65);}
      for(let iz=0;iz<length;iz++)for(let ix=0;ix<width;ix++){const a=iz*(width+1)+ix,b=a+1,c=a+width+1,d=c+1;indices.push(a,c,b,b,c,d);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();panel(geo,cloth);
      for(const z of [-1.65,0,1.65])for(let i=0;i<6;i++){const t=i/6,u=(i+1)/6;beam([side*1.6*t,height(t,z)+.018,z],[side*1.6*u,height(u,z)+.018,z],.014,seam);}
      beam([side*1.6,.18,-1.65],[side*1.6,.18,1.65],.035,surface('wood'));
      for(const z of [-1.3,1.3]){beam([side*1.58,.24,z],[side*2.1,.1,z],.018,rope);beam([side*2.1,0,z],[side*2.1,.3,z],.05,surface('wood'));}
      const flap=new THREE.BufferGeometry();flap.setAttribute('position',new THREE.Float32BufferAttribute([0,2.82,1.66,side*1.6,.18,1.66,side*1.05,.35,1.68],3));flap.computeVertexNormals();panel(flap,cloth);
    }
    const rear=new THREE.BufferGeometry();rear.setAttribute('position',new THREE.Float32BufferAttribute([-1.6,.18,-1.65,0,2.85,-1.65,1.6,.18,-1.65],3));rear.computeVertexNormals();panel(rear,cloth);
    beam([0,2.8,-1.78],[0,2.8,1.78],.075,surface('wood'));beam([0,.1,-1.58],[0,2.8,-1.58],.06,surface('wood'));
    add(new THREE.BoxGeometry(2.8,.09,2.9),solid(0x6d7254),0,.09,0);add(new THREE.BoxGeometry(.85,.14,1.8),solid(0x7d8b77),-.45,.2,-.25);
    const roll=add(new THREE.CylinderGeometry(.19,.19,.85,12),solid(0x9ea487),-.45,.36,-1.05);roll.rotation.z=Math.PI/2;
  }else if(type==='workbench'){
    for(let i=0;i<5;i++)board(3,.2,.34,0,1.8,(i-2)*.36);
    for(const x of [-1.15,1.15]){for(const z of [-.6,.6])board(.22,1.65,.22,x,.825,z);board(.18,.16,1.42,x,.48,0);}
    board(2.5,.15,.14,0,.55,-.6);board(2.55,.12,1.35,0,.55,0);
    for(const z of [-.6,.6]){const brace=board(2.5,.12,.12,0,1.05,z);brace.rotation.z=z<0?.35:-.35;}
    board(.8,.55,.7,.4,.9,0);for(const x of [.08,.72])add(new THREE.BoxGeometry(.07,.57,.73),solid(0x48483c),x,.9,0);
    const handle=board(.09,.08,.75,.45,1.96,.05);handle.rotation.y=.45;
    add(timberGeometry(.42,.2,.18),solid(0x717778),.6,2.02,.34);
    const stone=add(new THREE.SphereGeometry(.35,12,8),surface('stone'),-.7,1.99,-.1);stone.scale.set(1,.3,.7);
    for(const x of [-1.15,1.15])for(const z of [-.65,.65])add(new THREE.CylinderGeometry(.025,.025,.01,6),solid(0x454a46),x,1.905,z);
  }
  root.userData.releaseSurface=()=>handles.forEach(handle=>handle.release());return root;
}
