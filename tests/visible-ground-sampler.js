// Read the actual rendered grid, including Float32 heights and its diagonal.
export function visibleGroundSampler(geometry){
  const {widthSegments:nx,heightSegments:nz,width,height}=geometry.parameters,p=geometry.attributes.position;
  if(!Number.isInteger(nx)||!Number.isInteger(nz)||p.count!==(nx+1)*(nz+1))throw Error('Expected terrain plane grid');
  const x0=p.getX(0),z0=p.getZ(0),dx=width/nx,dz=height/nz;
  return (x,z)=>{
    const gx=(x-x0)/dx,gz=(z-z0)/dz;if(gx<0||gz<0||gx>nx||gz>nz)return null;
    const ix=Math.min(nx-1,Math.floor(gx)),iz=Math.min(nz-1,Math.floor(gz)),u=gx-ix,v=gz-iz,i=iz*(nx+1)+ix;
    const a=p.getY(i),b=p.getY(i+nx+1),c=p.getY(i+nx+2),d=p.getY(i+1);
    return u+v<=1?a+u*(d-a)+v*(b-a):c+(1-u)*(b-c)+(1-v)*(d-c);
  };
}

// Isolated candidate: only decorative translations, never resource identities or geometry.
export function buildGroundRootVariants(batches,geometry){
  const sample=visibleGroundSampler(geometry),before={instances:0,minRootGap:Infinity,maxRootGap:-Infinity},after={instances:0,minRootGap:Infinity,maxRootGap:-Infinity},variants=[];
  const names=new Set(['meadow-grass','meadow-flowers','meadow-cover','meadow-shore','meadow-fern']);
  for(const batch of batches){if(!names.has(batch.name))continue;
    const original=batch.instanceMatrix.array.slice(),next=original.slice(),p=batch.geometry.attributes.position,roots=[];let low=Infinity;
    for(let i=0;i<p.count;i++)low=Math.min(low,p.getY(i));
    for(let i=0;i<p.count;i++)if(p.getY(i)<=low+1e-6)roots.push([p.getX(i),p.getY(i),p.getZ(i)]);
    for(let index=0;index<batch.count;index++){
      const k=index*16;let max=-Infinity,min=Infinity;
      for(const [x,y,z]of roots){const wx=original[k]*x+original[k+4]*y+original[k+8]*z+original[k+12],wy=original[k+1]*x+original[k+5]*y+original[k+9]*z+original[k+13],wz=original[k+2]*x+original[k+6]*y+original[k+10]*z+original[k+14],height=sample(wx,wz);if(height===null)throw Error('Decorative root outside rendered ground');const gap=wy-height;max=Math.max(max,gap);min=Math.min(min,gap);}
      next[k+13]=original[k+13]-max-.035;
      const shift=next[k+13]-original[k+13];before.instances++;after.instances++;
      before.maxRootGap=Math.max(before.maxRootGap,max);before.minRootGap=Math.min(before.minRootGap,min);
      after.maxRootGap=Math.max(after.maxRootGap,max+shift);after.minRootGap=Math.min(after.minRootGap,min+shift);
    }
    variants.push({batch,before:original,after:next});
  }
  return {variants,before,after};
}
export function applyGroundRootVariants(result,enabled){
  for(const {batch,before,after}of result.variants){batch.instanceMatrix.array.set(enabled?after:before);batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();}
}
