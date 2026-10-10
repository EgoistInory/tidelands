import * as THREE from '../vendor/three.module.min.js';

// Only direct, static children with privately owned geometries; joint groups stay intact.
export function mergeStaticParts(group){
  const buckets=new Map();
  for(const part of group.children){
    if(!part.isMesh||part.isSkinnedMesh||part.isInstancedMesh||Array.isArray(part.material)||part.children.length)continue;
    const names=Object.keys(part.geometry.attributes).sort();
    if(names.join(',')!=='normal,position,uv')continue;
    const key=`${part.material.uuid}:${part.castShadow}:${part.receiveShadow}:${part.visible}:${part.renderOrder}:${part.layers.mask}`;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(part);
  }
  for(const parts of buckets.values()){
    if(parts.length<2)continue;
    const transformed=parts.map(part=>{part.updateMatrix();return part.geometry.clone().applyMatrix4(part.matrix);});
    const geometry=new THREE.BufferGeometry();
    for(const name of ['position','normal','uv']){
      const size=transformed[0].attributes[name].itemSize;
      const values=new Float32Array(transformed.reduce((n,g)=>n+g.attributes[name].array.length,0));let offset=0;
      for(const g of transformed){values.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
      geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
    }
    const indices=[];let vertexOffset=0;
    for(const g of transformed){
      const count=g.index?g.index.count:g.attributes.position.count;
      for(let i=0;i<count;i++)indices.push(vertexOffset+(g.index?g.index.getX(i):i));
      vertexOffset+=g.attributes.position.count;
    }
    geometry.setIndex(indices);
    const first=parts[0],merged=new THREE.Mesh(geometry,first.material);
    merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;merged.visible=first.visible;merged.renderOrder=first.renderOrder;merged.layers.mask=first.layers.mask;
    for(const part of parts){group.remove(part);part.geometry.dispose();}
    transformed.forEach(g=>g.dispose());group.add(merged);
  }
}
