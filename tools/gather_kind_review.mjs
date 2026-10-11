// Visible palm/boot vertices on a stationary fixture; not real surface contact.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.min.js';
import {createCharacter,animateCharacter} from '../src/character.js';
const samples=[];
for(const kind of ['tree','stone','crystal','berry','fiber','shell'])for(const owned of [true,false]){
  const root=createCharacter(),gatherTool=['tree','stone','crystal'].includes(kind)&&owned?'axe':'hand';
  let minimumPalmHeight=Infinity,minimumSoleGap=Infinity;
  for(let frame=0;frame<=90;frame++){
    animateCharacter(root,{x:0,z:0,yaw:0,time:frame*.42/90,attackAt:-100,gatherAt:0,gatherKind:kind,gatherTool,selected:'sword'},1/200,()=>0);root.updateMatrixWorld(true);
    const palm=new THREE.Box3().setFromObject(root.userData.elbows[1].children[1]);minimumPalmHeight=Math.min(minimumPalmHeight,palm.min.y);
    for(const ankle of root.userData.ankles){const sole=ankle.getObjectByName('boot-sole'),p=sole.geometry.attributes.position;
      for(let i=0;i<p.count;i++)minimumSoleGap=Math.min(minimumSoleGap,new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(sole.matrixWorld).y);
    }
  }
  animateCharacter(root,{x:0,z:0,yaw:0,time:.21,attackAt:-100,gatherAt:0,gatherKind:kind,gatherTool,selected:'sword'},1/60,()=>0);root.updateMatrixWorld(true);
  const palm=new THREE.Box3().setFromObject(root.userData.elbows[1].children[1]);
  samples.push({kind,owned,gatherTool,visibleTool:root.userData.axe.visible?'axe':root.userData.sword.visible?'sword':'hand',palmBounds:{min:palm.min.toArray(),max:palm.max.toArray()},pelvisOffset:root.userData.body.position.y,minimumPalmHeight,minimumSoleGap});
  root.traverse(o=>{if(o.geometry)o.geometry.dispose();});
}
const source=['src/character.js','src/main.js','src/scene.js'];
const report={kind:'numerical-resource-kind-review',fullGoalComplete:false,scope:'Stationary flat mesh bounds and complete .42s cycles. No target surface/triangle contact, rendered quality, ordinary progress or performance proof.',samples,sourceSha256:Object.fromEntries(source.map(n=>[n,createHash('sha256').update(readFileSync(new URL('../'+n,import.meta.url))).digest('hex')]))};
writeFileSync(new URL('../docs/gather-kind-numerical.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(samples.map(({kind,owned,visibleTool,palmBounds,pelvisOffset,minimumPalmHeight,minimumSoleGap})=>({kind,owned,visibleTool,palmHeight:[palmBounds.min[1],palmBounds.max[1]],pelvisOffset,minimumPalmHeight,minimumSoleGap}))));
