import * as THREE from '../vendor/three.module.min.js';
import {RUIN_FOOTPRINTS} from './ruin-layout.js';
import {mergeStaticParts} from './merge-parts.js';

export function createRuin(origin,heightAt,stoneMaterial=null){
  const root=new THREE.Group(),base=heightAt(origin.x,origin.z),boxes=[];
  const stone=stoneMaterial??new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95});
  const inscription=new THREE.MeshStandardMaterial({color:0x4e665c,roughness:.88});
  const ground=(x,z)=>heightAt(origin.x+x,origin.z+z)-base;
  function add(geometry,x,y,z,{solid=true,material=stone}={}){
    const position=geometry.attributes.position,uv=geometry.attributes.uv,colors=[];
    for(let i=0;i<position.count;i++){
      const px=position.getX(i),py=position.getY(i),pz=position.getZ(i),tone=.78+.12*Math.sin(px*7.1+py*5.3+pz*3.9);
      colors.push(tone*.94,tone,tone*.91);if(uv)uv.setXY(i,uv.getX(i)/Math.PI,uv.getY(i)*.7);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);mesh.updateMatrix();
    if(solid)boxes.push(new THREE.Box3().setFromObject(mesh));return mesh;
  }
  function block(w,h,d,x,y,z,options){
    const shape=new THREE.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:d,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.055,bevelThickness:.055});geometry.translate(0,0,-d/2);return add(geometry,x,y,z,options);
  }
  const spring=Math.max(ground(-3.2,-3),ground(3.2,-3))+3.3;
  for(const [i,p] of RUIN_FOOTPRINTS.entries()){
    const y=ground(p.x,p.z);
    if(p.stele){
      block(1.35,2.1,.64,p.x,y+1.1,p.z);block(1.65,.2,.9,p.x,y+.1,p.z);
      // Shallow raised marks make the readable stone a distinct focal point.
      for(let line=0;line<4;line++)block(.65-line*.07,.045,.035,p.x,y+1.65-line*.27,p.z+.38,{material:inscription});
      continue;
    }
    const height=i<2?spring-y:p.height;
    block(1.8,.24,1.8,p.x,y+.12,p.z);
    const courses=Math.ceil((height-.44)/.56),drumHeight=(height-.44)/courses;
    for(let course=0;course<courses;course++){
      const geometry=new THREE.CylinderGeometry(.70-(course%3)*.025,.76-(course%2)*.025,drumHeight-.025,14,1);
      const pos=geometry.attributes.position;
      for(let n=0;n<pos.count;n++){const angle=Math.atan2(pos.getZ(n),pos.getX(n)),wear=1+.025*Math.sin(angle*5+course*1.9+i);pos.setX(n,pos.getX(n)*wear);pos.setZ(n,pos.getZ(n)*wear);}
      geometry.computeVertexNormals();add(geometry,p.x,y+.24+(course+.5)*drumHeight,p.z);
    }
    block(1.75,.2,1.65,p.x,y+height-.1,p.z);
  }
  for(let i=0;i<15;i++){
    const a=i*Math.PI/15+.01,b=(i+1)*Math.PI/15-.01,shape=new THREE.Shape();
    shape.moveTo(Math.cos(a)*2.8,Math.sin(a)*2.8);shape.lineTo(Math.cos(a)*3.6,Math.sin(a)*3.6);shape.lineTo(Math.cos(b)*3.6,Math.sin(b)*3.6);shape.lineTo(Math.cos(b)*2.8,Math.sin(b)*2.8);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:1.25,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.035,bevelThickness:.035});geometry.translate(0,0,-.625);add(geometry,0,spring,-3);
  }
  // Walk-over remnants stay below 0.2m and outside the central approach.
  for(let i=0;i<16;i++){const a=i*2.399,r=4.8+(i%3)*.35,x=Math.cos(a)*r,z=Math.sin(a)*r;block(.7+(i%3)*.14,.10,.48,x,ground(x,z)+.06,z,{solid:false});}
  root.userData.cameraBoxes=boxes;mergeStaticParts(root,{attributes:['color','normal','position','uv']});root.name='weathered-arch-ruin';return root;
}
