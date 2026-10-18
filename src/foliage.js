import * as THREE from '../vendor/three.module.min.js';
import {randomGenerator} from './world.js';

let leafMaterial,leafDepthMaterial,needleMaterial,needleDepthMaterial,barkMaterial;
const windTime={value:0};
const windStrength={value:1};
function leafWind(shader){
  shader.uniforms.leafWindTime=windTime;
  shader.uniforms.leafWindStrength=windStrength;
  shader.vertexShader='uniform float leafWindTime,leafWindStrength;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 leafWorld = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      leafWorld = instanceMatrix * leafWorld;
    #endif
    leafWorld = modelMatrix * leafWorld;
    float crown = clamp((position.y - 3.0) / 7.0, 0.0, 1.0);
    transformed.x += sin(leafWindTime * 1.2 + leafWorld.x * .11 + leafWorld.z * .13) * crown * crown * .16 * leafWindStrength;
    transformed.z += sin(leafWindTime * 1.1 + leafWorld.x * .09) * crown * crown * .10 * leafWindStrength;
    transformed.y += sin(leafWindTime * 2.0 + leafWorld.x * .5 + leafWorld.z * .5) * uv.x * .03 * leafWindStrength;
  `);
}
export function updateFoliage(time,strength=1){windTime.value=time;windStrength.value=Number.isFinite(strength)?THREE.MathUtils.clamp(strength,0,1):1;}
export function barkSurface(){
  if(barkMaterial)return barkMaterial;
  const width=128,height=256,data=new Uint8Array(width*height*4),random=randomGenerator(5321);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=(x+.5)/width*Math.PI*2,v=(y+.5)/height*Math.PI*2;
    const furrow=Math.pow(Math.max(0,Math.sin(u*13+Math.sin(v*3+u*2)*.45)),8)*34;
    const mottling=Math.sin(u*4+v*2)*Math.sin(v*3+u*3)*7,grain=(random()-.5)*9;
    const i=(y*width+x)*4;
    data[i]=112-furrow+mottling+grain;data[i+1]=89-furrow*.8+mottling+grain;data[i+2]=64-furrow*.6+mottling+grain;data[i+3]=255;
  }
  const map=new THREE.DataTexture(data,width,height);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
  barkMaterial=new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:.045,roughness:.96});
  return barkMaterial;
}
function canopyMipmaps(data,size){
  const coverage=data.filter((v,i)=>i%4===3&&v>=89).length/(size*size),mips=[{data,width:size,height:size}];
  let raw=data,width=size;
  while(width>1){
    const nextWidth=width/2,next=new Uint8Array(nextWidth*nextWidth*4);
    for(let y=0;y<nextWidth;y++)for(let x=0;x<nextWidth;x++)for(let c=0;c<4;c++){
      let sum=0;for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++)sum+=raw[((y*2+dz)*width+x*2+dx)*4+c];
      next[(y*nextWidth+x)*4+c]=Math.round(sum/4);
    }
    // Upload adjusted alpha, but downsample the unadjusted source at the next level.
    const upload=next.slice(),alpha=Array.from(next).filter((v,i)=>i%4===3).sort((a,b)=>b-a);
    const cutoff=alpha[Math.max(0,Math.ceil(coverage*alpha.length)-1)],gain=153/Math.max(1,cutoff);
    for(let i=3;i<upload.length;i+=4)upload[i]=Math.min(255,Math.round(upload[i]*gain));
    if(nextWidth===1)upload[3]=Math.max(153,upload[3]);
    mips.push({data:upload,width:nextWidth,height:nextWidth});raw=next;width=nextWidth;
  }
  return mips;
}
function leaves(needles=false){
  if(needles?needleMaterial:leafMaterial)return needles?needleMaterial:leafMaterial;
  const size=128,data=new Uint8Array(size*size*4);
  const blades=needles?Array.from({length:14},(_,i)=>[-1,1].map(side=>[side*(.12+Math.sin(i/14*Math.PI)*.12),-.57+i*.083,side*1.05,.037,.29])).flat():[[-.28,-.37,-.72,.25,.36],[.27,-.18,.72,.25,.36],[-.28,.14,-.72,.25,.36],[.26,.35,.72,.25,.36],[0,.64,0,.23,.33]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
    let alpha=0,vein=0;
    // Each card represents a leafy twig, avoiding metre-wide individual leaves.
    for(const [cx,cy,angle,w,h]of blades){
      const dx=u-cx,dy=v-cy,lx=(dx*Math.cos(angle)-dy*Math.sin(angle))/w,ly=(dx*Math.sin(angle)+dy*Math.cos(angle))/h;
      const edge=1-lx*lx-Math.pow(Math.abs(ly),1.25)+Math.sin(ly*39)*.025;
      const opacity=THREE.MathUtils.clamp(edge*30,0,1);
      if(opacity>alpha){alpha=opacity;vein=Math.abs(lx)<.07?13:0;}
    }
    if(Math.abs(u)<.024&&v>-.7&&v<.72)alpha=1;
    const grain=Math.sin(x*13+y*7)*3;
    const i=(y*size+x)*4;data[i]=110+grain+vein;data[i+1]=141+grain+vein;data[i+2]=73+grain;data[i+3]=Math.round(alpha*255);
  }
  const map=new THREE.DataTexture(data,size,size);map.colorSpace=THREE.SRGBColorSpace;
  map.mipmaps=canopyMipmaps(data,size);map.generateMipmaps=false;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
  const material=new THREE.MeshStandardMaterial({map,vertexColors:true,side:THREE.DoubleSide,alphaTest:.35,alphaToCoverage:true,roughness:.94});
  // Shadow vertices use the same displacement and clock as visible leaves.
  const depth=new THREE.MeshDepthMaterial({map,side:THREE.DoubleSide,alphaTest:.35,depthPacking:THREE.RGBADepthPacking});
  for(const m of [material,depth]){m.onBeforeCompile=leafWind;m.customProgramCacheKey=()=> 'tidelands-leaf-wind-v2';}
  if(needles){needleMaterial=material;needleDepthMaterial=depth;}else{leafMaterial=material;leafDepthMaterial=depth;}
  return material;
}

export const TREE_CROWN_ANCHORS=Array.from({length:7},(_,i)=>[Math.cos(i*2.399)*(i===6?0:1.35),i===6?8.1:5.4+(i%3)*1.15,Math.sin(i*2.399)*(i===6?0:1.35)]);

// One mesh is instanced across the world; individual leaves add no draw calls.
export function createCanopy({anchors=TREE_CROWN_ANCHORS,seed=3517,leavesPerCluster=96,spread=1,verticalScale=1,leafScale=1,needles=false}={}){
  const random=randomGenerator(seed),positions=[],uv=[],colors=[],point=new THREE.Vector3(),rotation=new THREE.Quaternion();
  const low=Math.min(...anchors.map(a=>a[1]))-1.5*verticalScale,high=Math.max(...anchors.map(a=>a[1]))+1.5*verticalScale;
  for(let cluster=0;cluster<anchors.length;cluster++){
    const angle=cluster*2.399,[ax,cy,az]=anchors[cluster];
    for(let leaf=0;leaf<leavesPerCluster;leaf++){
      const phi=random()*Math.PI*2,height=random()*2-1,radius=.65+random();
      const horizontal=Math.sqrt(1-height*height);
      const cx=ax+Math.cos(phi)*horizontal*radius*1.1*spread;
      const y=cy+height*radius*(.77+(cluster%2)*.2)*verticalScale,cz=az+Math.sin(phi)*horizontal*radius*.95*spread;
      rotation.setFromEuler(new THREE.Euler(-.35-random()*1.15,angle+(random()-.5)*1.8,(random()-.5)*1.4));
      const w=(.65+random()*.35)*leafScale,h=(.35+random()*.2)*leafScale,tone=.52+random()*.14+.40*THREE.MathUtils.clamp((y-low)/(high-low),0,1);
      for(const [x,z,s,t] of [[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,-.5,0,0],[.5,.5,1,1],[-.5,.5,0,1]]){
        point.set(x*w,z*h,0).applyQuaternion(rotation).add(new THREE.Vector3(cx,y,cz));
        positions.push(point.x,point.y,point.z);uv.push(s,t);colors.push(tone*.9,tone,tone*.88);
      }
    }
  }
  return foliageMesh(positions,uv,colors,needles);
}

export function createBerryFoliage(){
  const random=randomGenerator(7119),positions=[],uv=[],colors=[],point=new THREE.Vector3(),rotation=new THREE.Quaternion();
  for(let cluster=0;cluster<6;cluster++){
    const angle=cluster*2.399,r=cluster===5?0:.55,cy=.95+(cluster%3)*.22;
    for(let leaf=0;leaf<40;leaf++){
      const phi=random()*Math.PI*2,height=random()*2-1,radius=.2+random()*.4,horizontal=Math.sqrt(1-height*height);
      const cx=Math.cos(angle)*r+Math.cos(phi)*horizontal*radius,y=cy+height*radius*.7,cz=Math.sin(angle)*r+Math.sin(phi)*horizontal*radius;
      rotation.setFromEuler(new THREE.Euler(random()*Math.PI,random()*Math.PI*2,random()*Math.PI));
      const w=.24+random()*.12,h=.12+random()*.07,tone=.77+random()*.3;
      for(const [x,z,s,t] of [[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,-.5,0,0],[.5,.5,1,1],[-.5,.5,0,1]]){
        point.set(x*w,z*h,0).applyQuaternion(rotation).add(new THREE.Vector3(cx,y,cz));
        positions.push(point.x,point.y,point.z);uv.push(s,t);colors.push(tone*.91,tone,tone*.85);
      }
    }
  }
  return foliageMesh(positions,uv,colors);
}

function foliageMesh(positions,uv,colors,needles=false){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  // Bound the shader's maximum displacement so frustum culling cannot cut off swaying leaves.
  geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(.22);
  geometry.computeBoundingSphere();geometry.boundingSphere.radius+=.22;
  const canopy=new THREE.Mesh(geometry,leaves(needles));canopy.customDepthMaterial=needles?needleDepthMaterial:leafDepthMaterial;canopy.castShadow=canopy.receiveShadow=true;
  return canopy;
}
