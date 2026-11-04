// Non-resource regional bedrock study; shared production rock textures, new closed geometry.
import * as THREE from '../vendor/three.module.min.js';
import {ISLANDS,LANDMARKS,SPAWN,terrain,randomGenerator} from '../src/world.js';
import {resourceHalfSize} from '../src/resource-contact.js';
const local=(p,o)=>{const c=Math.cos(o.rotation),s=Math.sin(o.rotation),x=p.x-o.x,z=p.z-o.z;return {x:c*x-s*z,z:s*x+c*z};};
export function escarpmentOverlaps(o,p,margin=0){const q=local(p,o);return (q.x/(o.length*1.15+margin))**2+(q.z/(o.width*1.15+margin))**2<1;}
function segmentDistance(p,a,b){const x=b.x-a.x,z=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z||1)));return Math.hypot(p.x-a.x-x*t,p.z-a.z-z*t);}
export function escarpmentPlan(objects){
  const island=ISLANDS[2],random=randomGenerator(5110426),candidates=[],rows=[];
  const routes=LANDMARKS.filter(p=>['explorer','ruin'].includes(p.id)).map(p=>[p,island]);
  for(let z=island.z-66;z<=island.z+58;z+=7)for(let x=island.x-68;x<=island.x+68;x+=7){
    const y=terrain(x,z),gx=(terrain(x+2,z)-terrain(x-2,z))/4,gz=(terrain(x,z+2)-terrain(x,z-2))/4,slope=Math.hypot(gx,gz);
    const o={id:`bedrock-${candidates.length}-${x}-${z}`,x,z,length:7+random()*3.5,width:2.8+random()*1.2,height:3.5+random()*2.8,rotation:Math.atan2(-gx,-gz),seed:Math.floor(random()*1e6)};
    if(y<22||y>43||slope<.16||slope>.8||Math.hypot(x-island.x,z-island.z)>island.r*.76)continue;
    if([SPAWN,...LANDMARKS].some(p=>escarpmentOverlaps(o,p,p.type==='npc'?18:14)))continue;
    if(routes.some(([a,b])=>segmentDistance(o,a,b)<o.length*1.15+5))continue;
    if(objects.some(p=>escarpmentOverlaps(o,p,Math.max(p.type==='tree'?2.4:1,resourceHalfSize(p))+1.5)))continue;
    candidates.push({...o,rank:y+slope*12+random()*4});
  }
  for(const p of candidates.sort((a,b)=>b.rank-a.rank)){
    if(rows.some(o=>escarpmentOverlaps(o,p,p.length*1.15+3)))continue;
    rows.push(p);if(rows.length===8)break;
  }
  return rows;
}
export function escarpmentGeometry(o){
  const random=randomGenerator(o.seed),n=12,outline=Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return {x:Math.cos(a)*o.length*(.84+random()*.2),z:Math.sin(a)*o.width*(.84+random()*.2),jitter:random()};}),rings=[],c=Math.cos(o.rotation),s=Math.sin(o.rotation);
  for(let level=0;level<5;level++){
    const t=level/4,scale=[1,.98,.87,.9,.70][level],shiftX=Math.sin(level*1.8+o.seed)*.28,shiftZ=Math.cos(level*2.1+o.seed)*.22;
    rings.push(outline.map(p=>{const u=p.x*scale+shiftX,v=p.z*scale+shiftZ,x=o.x+c*u+s*v,z=o.z-s*u+c*v;return new THREE.Vector3(x,terrain(x,z)-.8+t*(o.height+.8)+(level?Math.sin(p.jitter*9+level)*.24:0),z);}));
  }
  const positions=[],uvs=[],colors=[];
  function triangle(a,b,c){
    const normal=new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b,a),new THREE.Vector3().subVectors(c,a)).normalize(),cap=Math.abs(normal.y)>.65;
    for(const p of [a,b,c]){positions.push(...p.toArray());uvs.push((cap?p.x:Math.abs(normal.x)>Math.abs(normal.z)?p.z:p.x)/(2*Math.PI),(cap?p.z:p.y)/Math.PI);const variation=.92+Math.sin(p.y*.9+o.seed)*.035;colors.push(.66*variation,.69*variation,.67*variation);}
  }
  for(let k=0;k<4;k++)for(let i=0;i<n;i++){const j=(i+1)%n;triangle(rings[k][i],rings[k+1][i],rings[k][j]);triangle(rings[k][j],rings[k+1][i],rings[k+1][j]);}
  const top=new THREE.Vector3(o.x,terrain(o.x,o.z)+o.height-.2,o.z),bottom=new THREE.Vector3(o.x,Math.min(...rings[0].map(p=>p.y))-2,o.z);
  for(let i=0;i<n;i++){const j=(i+1)%n;triangle(top,rings[4][j],rings[4][i]);triangle(bottom,rings[0][i],rings[0][j]);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function createEscarpmentCandidate(view){
  const plan=escarpmentPlan(view.world.objects),root=new THREE.Group();root.name='regional-escarpment-candidate';root.visible=false;
  const meshes=plan.map(p=>{const mesh=new THREE.Mesh(escarpmentGeometry(p),view.rockSurface);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.placement=p;root.add(mesh);return mesh;});view.scene.add(root);let released=false;
  return {root,plan,meshes,setEnabled(v){root.visible=v;},update(state){for(const m of meshes)m.visible=!state.buildings.some(b=>escarpmentOverlaps(m.userData.placement,b,b.type==='tent'?4.2:3.1));},release(){if(released)return;released=true;root.removeFromParent();meshes.forEach(m=>m.geometry.dispose());root.clear();}};
}
