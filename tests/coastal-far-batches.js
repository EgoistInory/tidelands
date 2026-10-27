// Candidate utility only: caller owns source cards, materials and geometries.
// Batches are identity children of the world scene, so instance matrices are world matrices.
export function createCoastalFarBatches(THREE,scene,trees){
  const models=new Map();
  for(const tree of trees)models.set(tree.model,(models.get(tree.model)??0)+1);
  const byModel=new Map(),batches=[];
  for(const [model,capacity]of models){
    const views=model.farMaterials.map(material=>{
      const batch=new THREE.InstancedMesh(model.farGeometry,material,capacity);
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.count=0;batch.visible=false;
      scene.add(batch);batches.push(batch);return batch;
    });byModel.set(model,views);
  }
  let released=false;
  return {batches,update(){
    if(released)return;
    for(const batch of batches)batch.count=0;
    for(const tree of trees){
      if(tree.level!=='far')continue;
      const frame=tree.farFrame??tree.model.farMaterials.indexOf(tree.far.material),batch=byModel.get(tree.model)[frame];
      if(!batch)throw new Error('Unknown coastal far view');
      tree.far.updateWorldMatrix(true,false);batch.setMatrixAt(batch.count++,tree.far.matrixWorld);
    }
    for(const batch of batches){batch.visible=batch.count>0;batch.instanceMatrix.needsUpdate=true;if(batch.count)batch.computeBoundingSphere();}
  },release(){if(released)return;released=true;for(const batch of batches){scene.remove(batch);batch.dispose();}}};
}
