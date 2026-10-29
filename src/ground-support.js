// Read the rendered Float32 grid and its actual PlaneGeometry diagonal.
export function visibleGroundSampler(geometry){
  const {widthSegments:nx,heightSegments:nz,width,height}=geometry.parameters,p=geometry.attributes.position;
  if(!Number.isInteger(nx)||!Number.isInteger(nz)||nx<=0||nz<=0||p.count!==(nx+1)*(nz+1))throw Error('Expected terrain plane grid');
  const x0=p.getX(0),z0=p.getZ(0),dx=width/nx,dz=height/nz;
  return (x,z)=>{
    const gx=(x-x0)/dx,gz=(z-z0)/dz;if(gx<0||gz<0||gx>nx||gz>nz)return null;
    const ix=Math.min(nx-1,Math.floor(gx)),iz=Math.min(nz-1,Math.floor(gz)),u=gx-ix,v=gz-iz,i=iz*(nx+1)+ix;
    const a=p.getY(i),b=p.getY(i+nx+1),c=p.getY(i+nx+2),d=p.getY(i+1);
    return u+v<=1?a+u*(d-a)+v*(b-a):c+(1-u)*(b-c)+(1-v)*(d-c);
  };
}

// Correct decorative Y before regional buffers/bounds exist. No review snapshots are retained.
export function seatMeadowRoots(geometry,matrices,sample){
  const p=geometry.attributes.position,roots=[],f=new Float32Array(16);let low=Infinity;
  for(let i=0;i<p.count;i++)low=Math.min(low,p.getY(i));
  for(let i=0;i<p.count;i++)if(p.getY(i)<=low+1e-6)roots.push([p.getX(i),p.getY(i),p.getZ(i)]);
  for(const matrix of matrices){
    // Evaluate the same rounded coordinates that the eventual instance buffer uses.
    f.set(matrix.elements);let max=-Infinity;
    for(const [x,y,z]of roots){
      const wx=f[0]*x+f[4]*y+f[8]*z+f[12],wy=f[1]*x+f[5]*y+f[9]*z+f[13],wz=f[2]*x+f[6]*y+f[10]*z+f[14],height=sample(wx,wz);
      if(!Number.isFinite(height))throw Error('Decorative root outside rendered ground');
      max=Math.max(max,wy-height);
    }
    matrix.elements[13]=f[13]-max-.035;
  }
}
