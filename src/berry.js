import * as THREE from '../vendor/three.module.min.js';
import {barkSurface} from './foliage.js';

// Original local geometry and generated micro-surfaces; no external asset or request.
const toColor=hex=>new THREE.Color(hex);
function texture(width,height,sample,color=false){
  const data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set([...sample(x/width,y/height),255],(y*width+x)*4);
  const map=new THREE.DataTexture(data,width,height);map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.needsUpdate=true;return map;
}
let leafSurface,fruitSurface;
function surfaces(){
  if(leafSurface)return;
  const veins=texture(128,128,(u,v)=>{
    const mid=Math.exp(-Math.abs(u-.5)*150),side=Math.pow(Math.max(0,Math.cos((v-Math.abs(u-.5)*.6)*Math.PI*24)),30)*Math.exp(-Math.abs(u-.5)*2);
    const shade=5*Math.sin(u*140+v*97),vein=mid*24+side*9;
    return [57+vein+shade,91+vein+shade,38+vein*.6+shade];
  },true);
  leafSurface=new THREE.MeshStandardMaterial({map:veins,bumpMap:veins,bumpScale:.012,roughness:.75,vertexColors:true,side:THREE.DoubleSide});
  const skin=texture(64,64,(u,v)=>{const p=128+18*Math.sin(u*173+v*59)*Math.sin(v*211-u*83);return [p,p,p];});
  fruitSurface=new THREE.MeshStandardMaterial({vertexColors:true,bumpMap:skin,bumpScale:.0035,roughness:.42});
}
function collector(material,name){
  const position=[],normal=[],uv=[],color=[];
  return {
    add(geometry,matrix,tint=toColor(0xffffff)){
      const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(matrix);
      for(const key of ['position','normal','uv']){const attr=g.attributes[key];({position,normal,uv})[key].push(...attr.array);}
      for(let i=0;i<g.attributes.position.count;i++)color.push(tint.r,tint.g,tint.b);
      g.dispose();geometry.dispose();
    },
    finish(){const g=new THREE.BufferGeometry();for(const [key,values,size] of [['position',position,3],['normal',normal,3],['uv',uv,2],['color',color,3]])g.setAttribute(key,new THREE.Float32BufferAttribute(values,size));g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh;}
  };
}
const matrix=(p,q=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1))=>new THREE.Matrix4().compose(p,q,s);
export function createBerryBush(){
  surfaces();const stems=collector(barkSurface(),'connected-berry-canes'),leaves=collector(leafSurface,'curved-veined-leaves'),fruit=collector(fruitSurface,'attached-berry-clusters');
  const attachments=[],up=new THREE.Vector3(0,1,0),origin=new THREE.Vector3(0,-.04,0);
  function stem(a,b,r){const d=b.clone().sub(a),q=new THREE.Quaternion().setFromUnitVectors(up,d.clone().normalize());stems.add(new THREE.CylinderGeometry(r*.65,r,d.length(),5,1,true),matrix(a.clone().add(b).multiplyScalar(.5),q));}
  function leaf(a,d,length,width,tone){
    const q=new THREE.Quaternion().setFromUnitVectors(up,d.clone().normalize()),points=[],uv=[];
    const point=(t,side)=>new THREE.Vector3(side*Math.sin(Math.PI*t)*width*.5,length*t,-.035*Math.sin(Math.PI*t)+Math.abs(side)*.025*Math.sin(Math.PI*t));
    for(let i=0;i<5;i++)for(const side of [-1,1]){const t=i/5,n=(i+1)/5;for(const [v,s] of [[t,0],[n,0],[n,side],[t,0],[n,side],[t,side]]){points.push(...point(v,s).toArray());uv.push(.5+s*.5,v);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();leaves.add(g,matrix(a,q),toColor(0xffffff).multiplyScalar(tone));
  }
  for(let i=0;i<7;i++){
    const angle=i*2.399,radial=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),height=1.12+(i%3)*.18,reach=.55+(i%2)*.12;
    const control=radial.clone().multiplyScalar(.15).setY(height*1.1),tip=radial.clone().multiplyScalar(reach).setY(height),curve=new THREE.QuadraticBezierCurve3(origin,control,tip);
    let prev=origin;for(let k=1;k<=7;k++){const p=curve.getPoint(k/7);stem(prev,p,.033*(1-k/9));prev=p;}
    for(let j=0;j<4;j++){
      const a=curve.getPoint(.36+j*.17),side=new THREE.Vector3(Math.cos(angle+(j%2?-.7:.7)),.18,Math.sin(angle+(j%2?-.7:.7))).normalize(),end=a.clone().addScaledVector(side,.29+(j%2)*.08);stem(a,end,.009);
      for(let k=0;k<3;k++){
        const base=a.clone().lerp(end,.35+k*.25),direction=side.clone().applyAxisAngle(up,(k%2?-.8:.75)).setY(.5-(k%2)*.65).normalize(),petiole=base.clone().addScaledVector(direction,.055);
        stem(base,petiole,.003);leaf(petiole,direction,.24+(j%2)*.04,.115+(k%2)*.025,.82+(j/4)*.24);
      }
      if(j===3)for(let k=0;k<3;k++){
        const b=end.clone().add(new THREE.Vector3((k-1)*.065,-.10-k*.025,0));stem(end,b,.0035);
        const center=b.clone().add(new THREE.Vector3(0,-.064,0));attachments.push({stemEnd:b.toArray(),center:center.toArray(),radius:.065});
        fruit.add(new THREE.SphereGeometry(.065,10,8),matrix(center,new THREE.Quaternion(),new THREE.Vector3(1,1.12,1)),toColor(k===0?0xa44632:k===1?0xb96938:0x876d3d));
        for(let s=0;s<5;s++){const phi=s*Math.PI*2/5,g=new THREE.BufferGeometry(),tip=new THREE.Vector3(Math.cos(phi)*.029,.003,Math.sin(phi)*.029),edge=new THREE.Vector3(-Math.sin(phi)*.008,0,Math.cos(phi)*.008);g.setAttribute('position',new THREE.Float32BufferAttribute([...edge.toArray(),...tip.toArray(),...edge.negate().toArray()],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,.5,1,1,0],2));g.computeVertexNormals();leaves.add(g,matrix(b),toColor(0x77945b));}
      }
    }
  }
  const g=new THREE.Group();g.add(stems.finish(),leaves.finish(),fruit.finish());g.userData.attachments=attachments;return g;
}
