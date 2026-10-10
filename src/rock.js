import * as THREE from '../vendor/three.module.min.js';
import {createRockSurface} from './rock-surface.js';

const surface=createRockSurface();
const dark=new THREE.Color(0x7f847c),light=new THREE.Color(0xb3afa0),moss=new THREE.Color(0x657554);

export function initializeRockSurface({loader=new THREE.TextureLoader(),anisotropy=1}={}){
  surface.userData.rock.load(loader,anisotropy);return surface;
}

export function createWeatheredRock(radius){
  const geometry=new THREE.IcosahedronGeometry(radius,3),positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=geometry.attributes.uv;
  // Whole tiles meet across the longitude seam; vertical density follows radius.
  const uvWidth=Math.max(1,Math.round(Math.PI*radius))/Math.PI;
  const colors=[],direction=new THREE.Vector3(),axis=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3();
  const point=n=>n.clone().multiplyScalar(radius*(.88+.05*Math.sin(n.x*4.3+n.z*2.7)+.04*Math.cos(n.y*5.1-n.x*1.9)));
  for(let i=0;i<positions.count;i++){
    direction.fromBufferAttribute(positions,i).normalize();
    const p=point(direction);
    axis.set(Math.abs(direction.y)>.9?1:0,Math.abs(direction.y)>.9?0:1,0);
    a.crossVectors(direction,axis).normalize();b.crossVectors(direction,a).normalize();
    // Sample the deformed surface tangents, so duplicated vertices keep smooth normals.
    const tangent=v=>point(direction.clone().addScaledVector(v,.001).normalize()).sub(point(direction.clone().addScaledVector(v,-.001).normalize()));
    const normal=new THREE.Vector3().crossVectors(tangent(a),tangent(b)).normalize();
    if(normal.dot(direction)<0)normal.negate();
    positions.setXYZ(i,p.x,p.y,p.z);normals.setXYZ(i,normal.x,normal.y,normal.z);
    uv.setXY(i,uv.getX(i)*uvWidth,uv.getY(i)*radius);
    const patch=.5+.5*Math.sin(p.x*3.4+p.z*2.8)*Math.cos(p.y*2.7-p.x*.9);
    const grain=Math.sin(p.x*43+p.y*29)*Math.sin(p.z*31-p.y*17)*.04;
    const color=dark.clone().lerp(light,THREE.MathUtils.clamp(patch*.7+grain,0,1));
    color.lerp(moss,Math.max(0,1-(direction.y+.45)*2)*(.12+patch*.2));
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const rock=new THREE.Mesh(geometry,surface);rock.castShadow=rock.receiveShadow=true;
  return rock;
}
