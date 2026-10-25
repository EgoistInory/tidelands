import * as THREE from '../vendor/three.module.min.js';

const pools=new WeakMap(),SIZE=128;
function mapsFor(kind){
  const heights=new Float32Array(SIZE*SIZE),color=new Uint8Array(SIZE*SIZE*4),normal=new Uint8Array(SIZE*SIZE*4),rough=new Uint8Array(SIZE*SIZE*4);
  const noise=(x,y)=>{let n=Math.imul(x+127*y+41,374761393);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const i=y*SIZE+x,u=x/SIZE*Math.PI*2,v=y/SIZE*Math.PI*2,n=noise(x,y);
    const grain=kind==='wood'?.5+.09*Math.sin(v*9+Math.sin(u*2)*.8)+.035*Math.sin(v*27+Math.sin(u*3)*1.4)+.08*(n-.5):kind==='char'?.45+.22*Math.sin(u*13)*Math.cos(v*9)+.2*n:.5+.18*Math.sin(u*4+Math.sin(v*3))+.16*(n-.5);
    heights[i]=grain;
    const base=kind==='wood'?[143,112,77]:kind==='char'?[45,42,36]:[112,116,105];
    for(let c=0;c<3;c++)color[i*4+c]=Math.round(base[c]*(.82+grain*.32));color[i*4+3]=255;
    const r=Math.round(Math.min(1,.8+grain*.18)*255);rough.set([r,r,r,255],i*4);
  }
  const at=(x,y)=>heights[((y+SIZE)%SIZE)*SIZE+(x+SIZE)%SIZE];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const n=new THREE.Vector3((at(x-1,y)-at(x+1,y))*.4,(at(x,y-1)-at(x,y+1))*.4,1).normalize();
    normal.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],(y*SIZE+x)*4);
  }
  return [color,normal,rough].map((bytes,i)=>{const map=new THREE.DataTexture(bytes,SIZE,SIZE);map.name='camp-'+kind+'-'+['color','normal','roughness'][i];if(i===0)map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;});
}
export function acquireCampSurface(kind,cache){
  let pool=pools.get(cache);if(!pool){pool=new Map();pools.set(cache,pool);}
  let entry=pool.get(kind);if(!entry){entry={maps:mapsFor(kind),references:0};pool.set(kind,entry);}entry.references++;
  const [map,normalMap,roughnessMap]=entry.maps,material=new THREE.MeshStandardMaterial({map,normalMap,roughnessMap,roughness:1,normalScale:new THREE.Vector2(.5,.5)});let released=false;
  return {material,release(){if(released)return;released=true;if(--entry.references===0){entry.maps.forEach(map=>map.dispose());pool.delete(kind);}}};
}
