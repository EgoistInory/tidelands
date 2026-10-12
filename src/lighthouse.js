import * as THREE from '../vendor/three.module.min.js';
import {cottageSurfaces} from './cottage-surfaces.js';
import {mergeStaticParts} from './merge-parts.js';

let materials;
function surfaces(){
  if(materials)return materials;
  const shared=cottageSurfaces();
  materials={plaster:shared.plaster,wood:shared.wood,roof:shared.roof,
    stone:new THREE.MeshStandardMaterial({color:0x90968a,map:shared.plaster.map,bumpMap:shared.plaster.map,bumpScale:.06,roughness:.97}),
    metal:new THREE.MeshStandardMaterial({color:0x4d6662,roughness:.46,metalness:.45}),
    dark:new THREE.MeshStandardMaterial({color:0x293a37,roughness:.7}),
    glass:new THREE.MeshStandardMaterial({color:0xb1c7b9,roughness:.16,metalness:.12,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide})};
  return materials;
}
function arch(width,height,bottom=0){
  const r=width/2,shape=new THREE.Shape();shape.moveTo(-r,bottom);shape.lineTo(-r,bottom+height-r);shape.absarc(0,bottom+height-r,r,Math.PI,0,true);shape.lineTo(r,bottom);shape.closePath();return shape;
}
function openingFrame(width,height){const shape=arch(width+.28,height+.2);shape.holes.push(arch(width,height,.1));return new THREE.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2,curveSegments:12,steps:1});}
const wallRadius=y=>2.96-(y-.55)/19.2*.91;

export function createLighthouse(){
  const group=new THREE.Group(),m=surfaces();
  const add=(geometry,material,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const block=(w,h,d,material,x=0,y=0,z=0)=>add(new THREE.BoxGeometry(w,h,d),material,x,y,z);
  const ring=(radius,height,y,material=m.stone)=>add(new THREE.CylinderGeometry(radius,radius,height,48),material,0,y,0);
  ring(3.08,.36,.16);ring(3.02,.28,.46);
  const wallGeometry=new THREE.CylinderGeometry(2.05,2.96,19.2,48,8),wallUv=wallGeometry.attributes.uv;
  for(let i=0;i<wallUv.count;i++)wallUv.setXY(i,wallUv.getX(i)*8,wallUv.getY(i)*5);
  add(wallGeometry,m.plaster,0,10.15,0);
  for(const y of [.72,7.2,14.3])ring(wallRadius(y)+.035,.14,y);
  ring(2.86,.22,19.84);ring(2.74,.10,19.99,m.metal);
  for(const y of [20.43,20.97]){const rail=add(new THREE.TorusGeometry(2.76,.035,6,48),m.metal,0,y,0);rail.rotation.x=Math.PI/2;}
  for(let i=0;i<20;i++){const angle=i/20*Math.PI*2;block(.055,1.08,.055,m.metal,Math.cos(angle)*2.76,20.46,Math.sin(angle)*2.76);}
  for(const y of [20.235,23.165])ring(1.88,.13,y,m.metal);
  const panes=add(new THREE.CylinderGeometry(1.78,1.78,2.86,32,1,true),m.glass,0,21.7,0);panes.castShadow=false;
  for(let i=0;i<12;i++){const angle=i/12*Math.PI*2;block(.075,2.93,.075,m.metal,Math.cos(angle)*1.83,21.7,Math.sin(angle)*1.83);}
  const roofGeometry=new THREE.ConeGeometry(2.52,1.8,32),roofUv=roofGeometry.attributes.uv;
  for(let i=0;i<roofUv.count;i++)roofUv.setXY(i,roofUv.getX(i)*8,roofUv.getY(i)*2);
  add(roofGeometry,m.roof,0,24.1,0);
  const doorWidth=1.28,doorHeight=2.45;
  add(new THREE.ExtrudeGeometry(arch(doorWidth,doorHeight),{depth:.055,bevelEnabled:false,curveSegments:12}),m.dark,0,.63,3.00);
  add(openingFrame(doorWidth,doorHeight),m.stone,0,.53,2.98);
  for(let i=0;i<7;i++){
    const x=(i-3)*.17,r=doorWidth/2,height=doorHeight-r+Math.sqrt(r*r-(Math.abs(x)+.078)**2)-.04;
    block(.156,height,.055,m.wood,x,.66+height/2,3.075);
  }
  block(.06,.18,.04,m.metal,.38,1.8,3.13);
  for(const y of [4,9,14]){
    const z=wallRadius(y)+.05;
    add(new THREE.ExtrudeGeometry(arch(.62,1.25),{depth:.045,bevelEnabled:false,curveSegments:12}),m.dark,0,y-.6,z);
    add(openingFrame(.62,1.25),m.stone,0,y-.7,z-.02);
    block(.045,1.12,.055,m.metal,0,y-.02,z+.05);block(.56,.045,.055,m.metal,0,y-.09,z+.05);
  }
  const opticGeometry=new THREE.CylinderGeometry(.5,.5,1.3,24,24),p=opticGeometry.attributes.position;
  for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));if(r>.01){const scale=(.5+.045*Math.cos((p.getY(i)+.65)/1.3*Math.PI*12))/r;p.setX(i,p.getX(i)*scale);p.setZ(i,p.getZ(i)*scale);}}
  opticGeometry.computeVertexNormals();
  const lantern=add(opticGeometry,new THREE.MeshStandardMaterial({color:0xe7d49d,roughness:.26,metalness:.08,emissive:0x000000}),0,21.7,0);
  const beacon=new THREE.Group();beacon.position.y=21.7;
  const beam=new THREE.Mesh(new THREE.ConeGeometry(7,90,24,1,true),new THREE.MeshBasicMaterial({color:0xffe6a3,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}));
  beam.rotation.z=Math.PI/2;beam.position.x=45;beacon.add(beam,new THREE.PointLight(0xffd98a,65,55,1.5));beacon.visible=false;group.add(beacon);
  group.userData={lantern,beacon};group.updateMatrixWorld(true);mergeStaticParts(group);return group;
}
