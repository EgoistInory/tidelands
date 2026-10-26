import {createTree} from '../src/tree.js';
import {islandTreeAppearance} from '../src/landscape.js';
import {LANDMARKS,SPAWN} from '../src/world.js';
export function classifyTrees(objects){
  const trees=objects.filter(o=>o.type==='tree');
  return trees.map(node=>{
    const protectedNode=node.id.startsWith('starter-')||[SPAWN,...LANDMARKS].some(p=>Math.hypot(node.x-p.x,node.z-p.z)<22);
    const neighbours=trees.filter(other=>other!==node&&Math.hypot(node.x-other.x,node.z-other.z)<23).length;
    return {node,form:islandTreeAppearance(node).form,cohort:protectedNode?'retained':neighbours>=5?'mature':neighbours>=2?'edge':'young'};
  });
}
export function createCompositionTree(form,cohort){
  const tree=createTree(form);
  if(cohort==='retained')return tree;
  const spread=cohort==='mature'?({coast:1.5,forest:1.65,highland:1.3,shoal:1.5}[form]):cohort==='edge'?1.05:.72;
  const height=cohort==='mature'?.94:cohort==='edge'?.82:.65;
  for(const mesh of tree.children){
    const geometry=mesh.geometry,position=geometry.attributes.position;
    for(let i=0;i<position.count;i++){
      const y=position.getY(i),t=Math.max(0,Math.min(1,(y-2.4)/2)),blend=t*t*(3-2*t),width=1+(spread-1)*blend;
      position.setXYZ(i,position.getX(i)*width,y+Math.max(0,y-2.4)*(height-1),position.getZ(i)*width);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    geometry.boundingBox.expandByScalar(.22);geometry.boundingSphere.radius+=.22;
  }
  return tree;
}
