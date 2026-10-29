import {visibleGroundSampler} from './visible-ground-sampler.js';
const names=new Set(['meadow-grass','meadow-flowers','meadow-cover','meadow-shore','meadow-fern']);
// Read-only audit of the actual rendered buffers; never adjusts matrices or state.
export function observeGroundSupport(view){
 const started=performance.now(),ground=view.scene.children.find(o=>o.geometry?.parameters?.width===800&&o.geometry.parameters.widthSegments===320);
 if(!ground)throw Error('Rendered ground grid missing');
 const sample=visibleGroundSampler(ground.geometry),groups={};let minRootGap=Infinity,maxRootGap=-Infinity,instances=0,rootQueries=0,bufferBytes=0;
 for(const b of view.meadow){if(!names.has(b.name))continue;
  const p=b.geometry.attributes.position,a=b.instanceMatrix.array,roots=[];let low=Infinity;
  for(let i=0;i<p.count;i++)low=Math.min(low,p.getY(i));
  for(let i=0;i<p.count;i++)if(p.getY(i)<=low+1e-6)roots.push([p.getX(i),p.getY(i),p.getZ(i)]);
  const group=groups[b.name]??={instances:0,minRootGap:Infinity,maxRootGap:-Infinity};bufferBytes+=a.byteLength;
  for(let i=0;i<b.count;i++){
   const offset=i*16;
   for(const [x,y,z]of roots){const wx=a[offset]*x+a[offset+4]*y+a[offset+8]*z+a[offset+12],wy=a[offset+1]*x+a[offset+5]*y+a[offset+9]*z+a[offset+13],wz=a[offset+2]*x+a[offset+6]*y+a[offset+10]*z+a[offset+14],height=sample(wx,wz);if(!Number.isFinite(height))throw Error('Root outside visible terrain');const gap=wy-height;rootQueries++;group.minRootGap=Math.min(group.minRootGap,gap);group.maxRootGap=Math.max(group.maxRootGap,gap);}
   group.instances++;instances++;
  }
  minRootGap=Math.min(minRootGap,group.minRootGap);maxRootGap=Math.max(maxRootGap,group.maxRootGap);
 }
 return {instances,rootQueries,minRootGap,maxRootGap,bufferBytes,groups,auditCpuMs:performance.now()-started,scope:'Static rendered Float32 root positions, before camp hiding; wind and low-side burial remain quality limits.'};
}
