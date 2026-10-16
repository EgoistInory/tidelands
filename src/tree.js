import * as THREE from '../vendor/three.module.min.js';
import {barkSurface,createCanopy,TREE_CROWN_ANCHORS} from './foliage.js';

const trunkProfile=[[-.04,.52],[.22,.42],[.72,.335],[1.5,.29],[3,.225],[4.2,.18],[5.5,.13],[6.6,.075],[7.25,.028]];
export const TREE_FORMS=['coast','forest','highland','shoal'];
const profiles={
  coast:{anchors:TREE_CROWN_ANCHORS,height:1,lean:0,forks:2},
  forest:{anchors:Array.from({length:9},(_,i)=>[Math.cos(i*2.399)*(i===8?.2:2.5),5.6+(i%3)*1.35,Math.sin(i*2.399)*(i===8?.2:2.5)]),height:1.12,lean:.2,forks:2,spread:1.15,verticalScale:.85,leavesPerCluster:112,seed:6851},
  highland:{anchors:Array.from({length:12},(_,i)=>{const level=Math.floor(i/3),r=[2.25,1.7,1.15,.4][level],a=i*2.399;return [Math.cos(a)*r,4.8+level*1.05,Math.sin(a)*r];}),height:1.08,lean:.08,forks:1,spread:.65,verticalScale:.32,leavesPerCluster:56,needles:true,seed:8191},
  shoal:{anchors:Array.from({length:7},(_,i)=>[1.05+Math.cos(i*2.399)*1.9,6.6+(i%3)*.32,Math.sin(i*2.399)*1.65]),height:1,lean:1.05,forks:2,spread:1.2,verticalScale:.48,leavesPerCluster:96,seed:9349},
};
function trunkCenter(y,profile=profiles.coast){const t=Math.max(0,y)/7.25;return new THREE.Vector3(.12*Math.sin(y*.6)*t+.13*t+profile.lean*t*t,y*profile.height,.06*Math.sin(y*.7)*t-.09*t);}
function trunkRadius(y){
  for(let i=1;i<trunkProfile.length;i++)if(y<=trunkProfile[i][0]){
    const a=trunkProfile[i-1],b=trunkProfile[i];return THREE.MathUtils.lerp(a[1],b[1],THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1));
  }
  return trunkProfile.at(-1)[1];
}
function wood(geometry,name){const mesh=new THREE.Mesh(geometry,barkSurface());mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh;}
function trunk(profile){
  const geometry=new THREE.CylinderGeometry(.028,.52,7.29,18,12),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const y=positions.getY(i)+3.605,angle=Math.atan2(positions.getZ(i),positions.getX(i)),radius=Math.hypot(positions.getX(i),positions.getZ(i));
    const nominal=THREE.MathUtils.lerp(.52,.028,(y+.04)/7.29),center=trunkCenter(y,profile);
    const lobes=1+.045*Math.sin(angle*3+y*.8)+.12*Math.cos(angle*5+.4)*Math.exp(-Math.max(0,y)*3);
    const r=radius/nominal*trunkRadius(y)*lobes;
    positions.setXYZ(i,center.x+Math.cos(angle)*r,center.y,center.z+Math.sin(angle)*r);
  }
  geometry.computeVertexNormals();return wood(geometry,'tree-trunk');
}
function limb(points,baseRadius,tipRadius,segments=6,sides=6){
  const curve=new THREE.CatmullRomCurve3(points),geometry=new THREE.TubeGeometry(curve,segments,1,sides,false),p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let row=0;row<=segments;row++){
    const t=row/segments,center=curve.getPointAt(t),r=THREE.MathUtils.lerp(baseRadius,tipRadius,t);
    for(let col=0;col<=sides;col++){
      const i=row*(sides+1)+col,v=new THREE.Vector3().fromBufferAttribute(p,i).sub(center).multiplyScalar(r).add(center);
      p.setXYZ(i,v.x,v.y,v.z);uv.setXY(i,col/sides,t*curve.getLength()/7.29);
    }
  }
  geometry.computeVertexNormals();return wood(geometry,'tree-branch');
}

// Direct children allow shared wood merging after individual camera bounds are captured.
export function createTree(form='coast'){
  const profile=profiles[form]??profiles.coast,group=new THREE.Group();group.userData.treeForm=form;group.add(trunk(profile),createCanopy(profile));
  for(const [i,anchor] of profile.anchors.entries()){
    const end=new THREE.Vector3(...anchor),angle=i*2.399,start=trunkCenter(i===profile.anchors.length-1?6.35:3.95+(i%3)*.55,profile);
    const middle=start.clone().lerp(end,.53);middle.y-=.22;
    group.add(limb([start,middle,end],i===6?.065:.145-(i%3)*.023,.022));
    for(const side of profile.forks===1?[i%2?-1:1]:[-1,1]){
      const fork=middle.clone().lerp(end,.36),tip=end.clone().add(new THREE.Vector3(Math.cos(angle+side*.8)*.75,.35+side*.12,Math.sin(angle+side*.8)*.75));
      const bend=fork.clone().lerp(tip,.58);bend.y-=.08;
      group.add(limb([fork,bend,tip],.046,.011,3,5));
    }
  }
  return group;
}
