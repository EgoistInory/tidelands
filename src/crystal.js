import * as THREE from '../vendor/three.module.min.js';

const mineral=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.32,metalness:.08});
const matrix=new THREE.MeshStandardMaterial({color:0x5a625a,roughness:.94,flatShading:true});

export function createCrystalDeposit(){
  const positions=[],colors=[],uvs=[],dark=new THREE.Color(0x386765),light=new THREE.Color(0xb2ddd0);
  const triangle=(points,shade,height)=>{
    for(const point of points){
      positions.push(...point);
      const color=dark.clone().lerp(light,.15+.7*point[1]/height).multiplyScalar(shade);
      colors.push(color.r,color.g,color.b);uvs.push(point[0],point[1]/height);
    }
  };
  const growths=[[0,0,.5,3,.12,.04,0],[-.65,.2,.32,2,-.18,.08,.35],[.57,-.16,.38,2.5,.16,-.1,.12],
    [-.7,-.5,.2,.8,-.03,-.02,.2],[.6,.62,.22,.9,.04,.03,.7],[-.15,.8,.18,.6,0,.04,.1],
    [.8,-.55,.16,.55,.02,0,.4],[-.5,.65,.15,.5,-.02,.02,.8]];
  for(const [x,z,r,h,leanX,leanZ,rotation] of growths){
    const rings=[0,.72,1].map((t,level)=>Array.from({length:6},(_,i)=>{
      const angle=rotation+i*Math.PI/3,radius=level===2?.025:r*(level===1?.85:1);
      return [x+Math.cos(angle)*radius+leanX*t,.05+h*t,z+Math.sin(angle)*radius+leanZ*t];
    }));
    for(let level=0;level<2;level++)for(let i=0;i<6;i++){
      const next=(i+1)%6,a=rings[level][i],b=rings[level][next],c=rings[level+1][next],d=rings[level+1][i],shade=.84+(i%3)*.09;
      triangle([a,d,c],shade,h);triangle([a,c,b],shade,h);
    }
    for(let i=0;i<6;i++){
      triangle([[x,.05,z],rings[0][i],rings[0][(i+1)%6]],.8,h);
      triangle([[x+leanX,.05+h,z+leanZ],rings[2][(i+1)%6],rings[2][i]],1.05,h);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
  const group=new THREE.Group(),cluster=new THREE.Mesh(geometry,mineral),base=new THREE.Mesh(new THREE.CylinderGeometry(1.04,1.15,.23,9),matrix);
  cluster.name='mineral-prisms';base.name='rocky-matrix';base.position.y=.02;base.rotation.y=.2;
  for(const mesh of [cluster,base]){mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
  return group;
}
