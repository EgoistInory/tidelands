import * as THREE from '../vendor/three.module.min.js';
import {randomGenerator} from './world.js';

let surfaces;
export function cottageSurfaces(){
  if(surfaces)return surfaces;
  const texture=kind=>{
    const size=256,pixels=new Uint8Array(size*size*4),random=randomGenerator(kind==='roof'?891:kind==='wood'?893:892);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const grain=(random()-.5)*12,i=(y*size+x)*4;
      let rgb;
      if(kind==='roof'){
        const row=Math.floor(y/size*12),v=y/size*12-row;
        const tileX=x/size*8+(row%2)*.5,col=Math.floor(tileX),u=tileX-col;
        const tone=Math.sin(col*37+row*19)*9;
        const seam=u<.035||v<.065;
        const ridge=Math.sin(u*Math.PI)*15;
        const moss=Math.max(0,Math.sin(x*.033)*Math.cos(y*.047)-.52)*38;
        rgb=seam?[70,51,39]:[161+tone+ridge-moss,98+tone*.6+ridge*.4+moss*.3,65+tone*.35+ridge*.25];
      }else if(kind==='wood'){
        const rings=Math.sin(x*.19+Math.sin(y*.018+x*.026)*1.8)*6;
        const grainLines=Math.pow(Math.max(0,Math.sin(x*.57+Math.sin(y*.036)*.7)),8)*13;
        rgb=[136+rings-grainLines,108+rings*.8-grainLines,77+rings*.5-grainLines];
      }else{
        const cloud=Math.sin(x*.044+Math.cos(y*.039))*Math.cos(y*.026)*7;
        rgb=[220+cloud,210+cloud,185+cloud];
      }
      for(let c=0;c<3;c++)pixels[i+c]=Math.max(0,Math.min(255,Math.round(rgb[c]+grain)));
      pixels[i+3]=255;
    }
    const map=new THREE.DataTexture(pixels,size,size);
    map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
    map.generateMipmaps=true;map.needsUpdate=true;
    return map;
  };
  const roofMap=texture('roof'),plasterMap=texture('plaster'),woodMap=texture('wood');
  surfaces={
    roof:new THREE.MeshStandardMaterial({map:roofMap,bumpMap:roofMap,bumpScale:.07,roughness:.87}),
    plaster:new THREE.MeshStandardMaterial({map:plasterMap,bumpMap:plasterMap,bumpScale:.035,roughness:.98}),
    wood:new THREE.MeshStandardMaterial({map:woodMap,bumpMap:woodMap,bumpScale:.025,roughness:.9})
  };
  return surfaces;
}

export function cottageRoof(){
  const corners=[[-4.5,4.9,-3.6],[4.5,4.9,-3.6],[4.5,4.9,3.6],[-4.5,4.9,3.6]],top=[0,8.3,0],positions=[],uv=[];
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],width=Math.hypot(b[0]-a[0],b[2]-a[2]);
    const slope=Math.hypot(top[1]-a[1],(a[0]+b[0])*.5,(a[2]+b[2])*.5);
    positions.push(...a,...top,...b);uv.push(0,0,width/8,slope/4,width/4,0);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  const roof=new THREE.Mesh(geometry,cottageSurfaces().roof);roof.castShadow=roof.receiveShadow=true;
  return roof;
}
