// QA-only composition kit. Not installed in WorldView or the delivery manifest.
import * as THREE from '../vendor/three.module.min.js';
import {randomGenerator,terrain} from '../src/world.js';
export const COASTAL_ROUTE=[[-70,108],[-64,98],[-56,90],[-55,77],[-49,60],[-30,36],[-18,12]];
function corridorDistance(x,z){
 let best=Infinity;
 for(let i=1;i<COASTAL_ROUTE.length;i++){
  const [ax,az]=COASTAL_ROUTE[i-1],[bx,bz]=COASTAL_ROUTE[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
  best=Math.min(best,Math.hypot(x-ax-t*dx,z-az-t*dz));
 }return best;
}
export function coastalRouteLayout(objects=[],heightAt=terrain){
 const random=randomGenerator(90615),rows=[];
 for(let i=1;i<COASTAL_ROUTE.length;i++){
  const [ax,az]=COASTAL_ROUTE[i-1],[bx,bz]=COASTAL_ROUTE[i],length=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/length,nz=(bx-ax)/length;
  for(let distance=3;distance<length;distance+=6)for(const side of [-1,1]){
   const u=distance/length,offset=side*(7+random()*7),cx=ax+(bx-ax)*u+nx*offset,cz=az+(bz-az)*u+nz*offset;
   for(let j=0;j<9;j++){
    const angle=random()*Math.PI*2,r=Math.sqrt(random())*2.2,x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r,y=heightAt(x,z);
    const kind=j===0?'wood':j<4?'stone':'sedge',radius=kind==='wood'?.9:kind==='stone'?.35:.6;
    const yaw=random()*Math.PI*2,scale=.7+random()*.6;
    if(y<1.8||y>22||corridorDistance(x,z)<4.5+radius||Math.hypot(x+70,z-108)<10+radius)continue;
    if(objects.some(o=>Math.hypot(x-o.x,z-o.z)<5+radius))continue;
    if(Math.max(Math.abs(heightAt(x+.5,z)-y),Math.abs(heightAt(x-.5,z)-y),Math.abs(heightAt(x,z+.5)-y),Math.abs(heightAt(x,z-.5)-y))>.18)continue;
    rows.push({kind,x,y,z,yaw,scale,radius});
   }
  }
 }return rows;
}
export function createCoastalRouteCandidate(objects=[],heightAt=terrain){
 const layout=coastalRouteLayout(objects,heightAt),root=new THREE.Group();root.name='coastal-route-candidate';
 const wood=new THREE.CylinderGeometry(.055,.085,1.4,7);wood.rotateZ(Math.PI/2);wood.translate(0,.09,0);
 const stone=new THREE.IcosahedronGeometry(.23,1);stone.scale(1,.42,.7);stone.translate(0,.06,0);
 const sedge=new THREE.BufferGeometry(),vertices=[];
 for(let i=0;i<5;i++){
  const angle=i*2.39996,dx=Math.cos(angle),dz=Math.sin(angle),w=.028,h=.28+i*.055;
  vertices.push(-dz*w,0,dx*w,dz*w,0,-dx*w,dx*.13,h,dz*.13,dx*.13,h,dz*.13,dz*w,0,-dx*w,dx*.24,h*.78,dz*.24);
 }
 sedge.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));sedge.computeVertexNormals();
 const geometries={wood,stone,sedge},materials={wood:new THREE.MeshStandardMaterial({color:0x8b7d66,roughness:1}),stone:new THREE.MeshStandardMaterial({color:0x8e9586,roughness:1}),sedge:new THREE.MeshStandardMaterial({color:0x64704b,roughness:1,side:THREE.DoubleSide})};
 const matrix=new THREE.Object3D();
 for(const kind of ['wood','stone','sedge']){
  const entries=layout.filter(r=>r.kind===kind);if(!entries.length)continue;
  const batch=new THREE.InstancedMesh(geometries[kind],materials[kind],entries.length);batch.name=kind;batch.receiveShadow=true;batch.castShadow=kind==='sedge';
  for(const [index,row]of entries.entries()){matrix.position.set(row.x,row.y,row.z);matrix.rotation.set(0,row.yaw,0);matrix.scale.setScalar(row.scale);matrix.updateMatrix();batch.setMatrixAt(index,matrix.matrix);}
  batch.computeBoundingSphere();root.add(batch);
 }
 let released=false;
 return {root,layout,release(){if(released)return;released=true;for(const g of Object.values(geometries))g.dispose();for(const m of Object.values(materials))m.dispose();root.clear();}};
}
