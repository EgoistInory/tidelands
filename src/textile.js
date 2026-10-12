import * as THREE from '../vendor/three.module.min.js';

let maps;
function wovenMaps(){
  if(maps)return maps;
  const size=128,color=new Uint8Array(size*size*4),height=new Uint8Array(color.length);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/(size-1)*Math.PI*2,v=y/(size-1)*Math.PI*2;
    const crossing=Math.cos(u*16)*Math.cos(v*16);
    const relief=.5+.19*Math.cos(u*32)+.19*Math.cos(v*32)+.07*crossing;
    const worn=Math.cos(u*2+v)*Math.cos(v*3-u)*3;
    const tint=Math.round(230+(relief-.5)*14+worn),bump=Math.round(96+relief*100),i=(y*size+x)*4;
    color.set([tint,tint,tint,255],i);height.set([bump,bump,bump,255],i);
  }
  const texture=(data,colorSpace)=>{
    const map=new THREE.DataTexture(data,size,size);map.colorSpace=colorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;
    map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;return map;
  };
  maps={map:texture(color,THREE.SRGBColorSpace),bumpMap:texture(height,THREE.NoColorSpace)};return maps;
}

// Shared small maps give clothing and shelter the same canvas grain without asset loading.
export function createTextileMaterial(color,{side=THREE.FrontSide,roughness=.94}={}){
  const material=new THREE.MeshStandardMaterial({color,...wovenMaps(),roughness,bumpScale:.006,side});
  material.userData.textile=true;return material;
}
