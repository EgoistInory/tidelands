import {Box3,Triangle} from '../vendor/three.module.min.js';

// Store occupied surface cells, including exact grid-plane boundaries. No solid crown boxes.
export function woodySurfaceVoxels(positions,indices,cell=.2){
  if(!positions.length||positions.length%3||!indices.length||indices.length%3||!Number.isFinite(cell)||cell<.05||cell>1)throw Error('Invalid woody grid');
  for(const value of positions)if(!Number.isFinite(value))throw Error('Invalid woody position');
  for(const index of indices)if(!Number.isInteger(index)||index<0||index>=positions.length/3)throw Error('Invalid woody index');
  const triangle=new Triangle(),bounds=new Box3(),cellBox=new Box3(),epsilon=cell*1e-6,cells=new Set();let probes=0;
  for(let i=0;i<indices.length;i+=3){
    for(const [point,index]of [[triangle.a,indices[i]],[triangle.b,indices[i+1]],[triangle.c,indices[i+2]]])point.fromArray(positions,index*3);
    bounds.setFromPoints([triangle.a,triangle.b,triangle.c]);
    const min=bounds.min.toArray().map(v=>Math.floor((v-epsilon)/cell)),max=bounds.max.toArray().map(v=>Math.floor((v+epsilon)/cell)),count=max.reduce((n,v,axis)=>n*(v-min[axis]+1),1);
    probes+=count;if(count>100000||probes>5000000)throw Error('Woody voxel workload over budget');
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
      const key=`${x},${y},${z}`;if(cells.has(key))continue;
      cellBox.min.set(x*cell-epsilon,y*cell-epsilon,z*cell-epsilon);cellBox.max.set((x+1)*cell+epsilon,(y+1)*cell+epsilon,(z+1)*cell+epsilon);
      if(cellBox.intersectsTriangle(triangle))cells.add(key);
    }
  }
  return [...cells].map(key=>key.split(',').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
}
