// Offline-only contact preparation. No runtime terrain or collision rules are changed.
export function woodyInteriorCells(positions,indices,cell=.2){
 if(!positions.length||positions.length%3||!indices.length||indices.length%3||!Number.isFinite(cell)||cell<.05||cell>1||!positions.every(Number.isFinite)||!indices.every(i=>Number.isInteger(i)&&i>=0&&i<positions.length/3))throw Error('Invalid interior grid');
 const lines=new Map(),epsilon=1e-10;let probes=0;
 const edge=(a,b,y,z)=>(b[1]-a[1])*(z-a[2])-(b[2]-a[2])*(y-a[1]),topLeft=(a,b)=>b[2]>a[2]||(b[2]===a[2]&&b[1]<a[1]);
 for(let i=0;i<indices.length;i+=3){
  const p=[0,1,2].map(j=>Array.from(positions.subarray(indices[i+j]*3,indices[i+j]*3+3)));let [a,b,c]=p,area=edge(a,b,c[1],c[2]);if(Math.abs(area)<epsilon)continue;const sign=Math.sign(area);if(area<0){[b,c]=[c,b];area=-area;}
  const minY=Math.floor(Math.min(a[1],b[1],c[1])/cell),maxY=Math.floor(Math.max(a[1],b[1],c[1])/cell),minZ=Math.floor(Math.min(a[2],b[2],c[2])/cell),maxZ=Math.floor(Math.max(a[2],b[2],c[2])/cell);
  for(let y=minY;y<=maxY;y++)for(let z=minZ;z<=maxZ;z++){
   if(++probes>5000000)throw Error('Interior scan workload over budget');const yy=(y+.5)*cell,zz=(z+.5)*cell,weights=[edge(b,c,yy,zz),edge(c,a,yy,zz),edge(a,b,yy,zz)],edges=[[b,c],[c,a],[a,b]];
   if(weights.some((v,j)=>v< -epsilon||(Math.abs(v)<=epsilon&&!topLeft(...edges[j]))))continue;
   const x=(weights[0]*a[0]+weights[1]*b[0]+weights[2]*c[0])/area,key=`${y},${z}`;if(!lines.has(key))lines.set(key,[]);lines.get(key).push([x,sign]);
  }
 }
 const cells=new Set();let balancedLines=0,unbalancedLines=0;
 for(const [key,hits]of lines){
  hits.sort((a,b)=>a[0]-b[0]);const groups=[];for(const [x,sign]of hits){const prior=groups.at(-1);if(prior&&Math.abs(prior[0]-x)<1e-8)prior[1]+=sign;else groups.push([x,sign]);}
  if(groups.reduce((n,g)=>n+g[1],0)!==0){unbalancedLines++;continue;}balancedLines++;let winding=0,prior=null;const [y,z]=key.split(',').map(Number);
  for(const [x,delta]of groups){if(winding!==0&&prior!==null){if((x-prior)/cell>100000)throw Error('Interior interval over budget');for(let ix=Math.floor((prior+cell*1e-6)/cell);ix<=Math.floor((x-cell*1e-6)/cell);ix++){cells.add(`${ix},${y},${z}`);if(cells.size>500000)throw Error('Interior volume over budget');}}winding+=delta;prior=x;}
 }
 return {cells:[...cells].map(s=>s.split(',').map(Number)),balancedLines,unbalancedLines,probes};
}
