// Offline component reconstruction: every source leaf keeps one alpha-masked patch.
export function fitLeafPatch(positions,uvs,segments=2){
  if(![1,2].includes(segments)||positions.length<18||positions.length%3||uvs.length!==positions.length/3*2||![...positions,...uvs].every(Number.isFinite))throw Error('Invalid leaf surface');
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
  for(let i=0;i<uvs.length;i++){min[i%2]=Math.min(min[i%2],uvs[i]);max[i%2]=Math.max(max[i%2],uvs[i]);}
  if(max.some((v,i)=>v-min[i]<1e-7))throw Error('Degenerate leaf UV');
  const basis=(u,v)=>[1,u,v,v*v,u*v],matrix=Array.from({length:5},()=>Array(8).fill(0));
  for(let i=0;i<positions.length/3;i++){
    const b=basis((uvs[i*2]-min[0])/(max[0]-min[0])*2-1,(uvs[i*2+1]-min[1])/(max[1]-min[1])*2-1);
    for(let row=0;row<5;row++){for(let col=0;col<5;col++)matrix[row][col]+=b[row]*b[col];for(let axis=0;axis<3;axis++)matrix[row][5+axis]+=b[row]*positions[i*3+axis];}
  }
  for(let col=0;col<5;col++){
    let pivot=col;for(let row=col+1;row<5;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
    if(Math.abs(matrix[pivot][col])<1e-10)throw Error('Degenerate leaf surface fit');
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];const value=matrix[col][col];for(let k=col;k<8;k++)matrix[col][k]/=value;
    for(let row=0;row<5;row++)if(row!==col){const factor=matrix[row][col];for(let k=col;k<8;k++)matrix[row][k]-=factor*matrix[col][k];}
  }
  const point=(u,v)=>basis(u,v).reduce((p,b,i)=>p.map((value,axis)=>value+b*matrix[i][5+axis]),[0,0,0]);
  const result={positions:[],normals:[],uvs:[],indices:[],uvBounds:{min,max},maxSourceError:0};
  for(let j=0;j<=segments;j++)for(let i=0;i<2;i++){
    const u=i*2-1,v=j/segments*2-1,p=point(u,v),du=[0,1,2].map(a=>matrix[1][5+a]+v*matrix[4][5+a]),dv=[0,1,2].map(a=>matrix[2][5+a]+2*v*matrix[3][5+a]+u*matrix[4][5+a]);
    const n=[du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]],length=Math.hypot(...n);
    if(length<1e-14)throw Error('Degenerate leaf surface normal');
    result.positions.push(...p);result.normals.push(...n.map(value=>value/length));result.uvs.push(min[0]+i*(max[0]-min[0]),min[1]+j/segments*(max[1]-min[1]));
  }
  for(let j=0;j<segments;j++){const a=j*2;result.indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  for(let i=0;i<positions.length/3;i++){
    const p=point((uvs[i*2]-min[0])/(max[0]-min[0])*2-1,(uvs[i*2+1]-min[1])/(max[1]-min[1])*2-1);
    result.maxSourceError=Math.max(result.maxSourceError,Math.hypot(...p.map((v,axis)=>v-positions[i*3+axis])));
  }
  return result;
}
