import * as THREE from '../vendor/three.module.min.js';

const pools=new WeakMap(),SIZE=128;
function makeMaps(type){
  const height=new Float32Array(SIZE*SIZE),color=new Uint8Array(SIZE*SIZE*4),normal=new Uint8Array(SIZE*SIZE*4),rough=new Uint8Array(SIZE*SIZE*4);
  const noise=(x,y)=>{let n=Math.imul(x+131*y+37,type==='boar'?374761393:668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const i=y*SIZE+x,u=x/SIZE*Math.PI*2,v=y/SIZE*Math.PI*2,n=noise(x,y);
    const grain=type==='boar'?.5+.1*Math.sin(u*47+Math.sin(v*19)*2.5)+.23*(n-.5):.5+.22*Math.sin(u*9+Math.sin(v*4))*Math.cos(v*7)+.28*n;
    height[i]=grain;
    const speck=type==='crab'&&n>.94?-.22:0;
    const tone=THREE.MathUtils.clamp(.72+grain*.35+speck,.3,1.15),base=type==='boar'?[111,92,72]:[169,92,62];
    for(let c=0;c<3;c++)color[i*4+c]=Math.min(255,Math.round(base[c]*tone));color[i*4+3]=255;
    const r=Math.round((type==='boar'?.82+grain*.14:.62+grain*.24)*255);rough.set([r,r,r,255],i*4);
  }
  const at=(x,y)=>height[((y+SIZE)%SIZE)*SIZE+(x+SIZE)%SIZE];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const n=new THREE.Vector3((at(x-1,y)-at(x+1,y))*.28,(at(x,y-1)-at(x,y+1))*.28,1).normalize();
    normal.set([Math.round((n.x*.5+.5)*255),Math.round((n.y*.5+.5)*255),Math.round((n.z*.5+.5)*255),255],(y*SIZE+x)*4);
  }
  return [color,normal,rough].map((bytes,i)=>{const t=new THREE.DataTexture(bytes,SIZE,SIZE);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;if(i===0)t.colorSpace=THREE.SRGBColorSpace;t.name=type+'-'+['coat','normal','roughness'][i];t.needsUpdate=true;return t;});
}

export function acquireCreatureSurface(type,cache=null){
  let pool;if(cache){pool=pools.get(cache);if(!pool){pool=new Map();pools.set(cache,pool);}}
  let entry=pool?.get(type);if(!entry){entry={maps:makeMaps(type),references:0};pool?.set(type,entry);}entry.references++;
  const [map,normalMap,roughnessMap]=entry.maps;
  const material=new THREE.MeshStandardMaterial({map,normalMap,roughnessMap,roughness:1,normalScale:new THREE.Vector2(.55,.55)});
  let released=false;
  return {material,release(){if(released)return;released=true;if(--entry.references===0){entry.maps.forEach(t=>t.dispose());pool?.delete(type);}}};
}
