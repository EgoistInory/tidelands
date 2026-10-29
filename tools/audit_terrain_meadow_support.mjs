import * as THREE from '../vendor/three.module.min.js';
import {writeFileSync,readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {terrain,createWorld} from '../src/world.js';import {createMeadow} from '../src/meadow.js';
import {visibleGroundSampler} from '../tests/visible-ground-sampler.js';
const grid=new THREE.PlaneGeometry(800,800,320,320);grid.rotateX(-Math.PI/2);
for(let i=0;i<grid.attributes.position.count;i++){const p=grid.attributes.position;p.setY(i,terrain(p.getX(i),p.getZ(i)));}
const sample=visibleGroundSampler(grid),mesh=new THREE.Mesh(grid,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),checks=[];
for(let i=0;i<70;i++){const x=-310+i*9.17,z=-290+i*7.71;ray.set(new THREE.Vector3(x,100,z),down);const y=ray.intersectObject(mesh,false)[0]?.point.y;const error=Math.abs(y-sample(x,z));if(!(error<1e-5))throw Error('Grid sampler differs from real triangles: '+error);checks.push(error);}
const batches=createMeadow(undefined,createWorld().objects),rows=[],groups={},matrix=new THREE.Matrix4(),point=new THREE.Vector3();
const quantile=(a,q)=>[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*q)]??null;
for(const [batchIndex,batch]of batches.entries()){
 const positions=batch.geometry.attributes.position,rootIndices=[];let low=Infinity;
 for(let i=0;i<positions.count;i++)low=Math.min(low,positions.getY(i));
 for(let i=0;i<positions.count;i++)if(positions.getY(i)<=low+1e-6)rootIndices.push(i);
 const group=groups[batch.name]??={instances:0,centerGaps:[],rootGaps:[],grossFloat:0,grossBuried:0};
 for(let index=0;index<batch.count;index++){
  batch.getMatrixAt(index,matrix);const x=matrix.elements[12],y=matrix.elements[13],z=matrix.elements[14],centerGap=y-sample(x,z);let min=Infinity,max=-Infinity;
  for(const i of rootIndices){point.fromBufferAttribute(positions,i).applyMatrix4(matrix);const gap=point.y-sample(point.x,point.z);min=Math.min(min,gap);max=Math.max(max,gap);}
  group.instances++;group.centerGaps.push(centerGap);group.rootGaps.push(max);group.grossFloat+=Number(max>.15);group.grossBuried+=Number(min<-.2);
  rows.push({name:batch.name,batchIndex,index,x,y,z,centerGap,minRootGap:min,maxRootGap:max,rootPoints:rootIndices.length,analyticCenterGap:y-terrain(x,z)});
 }
}
for(const g of Object.values(groups)){g.centerGapRange=[Math.min(...g.centerGaps),Math.max(...g.centerGaps)];g.maxRootGap=Math.max(...g.rootGaps);g.rootGapP95=quantile(g.rootGaps,.95);delete g.centerGaps;delete g.rootGaps;}
const worst=[...rows].sort((a,b)=>b.maxRootGap-a.maxRootGap).slice(0,12),sources=Object.fromEntries(['src/scene.js','src/world.js','src/meadow.js','src/landscape.js'].map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')]));
const report={verified:true,scope:'Actual320 terrain triangle grid plus every generated decorative meadow root. Independent70 ray checks. Diagnostic only: production208 unchanged; not visual, full-grounding or GPU acceptance.',rayChecks:checks.length,maxRayError:Math.max(...checks),groups,worst,rows,sourceHashes:sources};
const raw=JSON.stringify(report)+'\n',rawPath='dist/meadow-visible-support-current-raw.json';writeFileSync(new URL('../'+rawPath,import.meta.url),raw);const {rows:omitted,...summary}=report;writeFileSync(new URL('../docs/meadow-visible-support-audit.json',import.meta.url),JSON.stringify({...summary,rowCount:rows.length,rawPath,rawSha256:createHash('sha256').update(raw).digest('hex')},null,2)+'\n');console.log(JSON.stringify({rayChecks:checks.length,maxRayError:report.maxRayError,groups,worst:worst.slice(0,3)}));
