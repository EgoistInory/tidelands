import {prepareCoastalVisual,bindCoastalVisual as bindOriginal} from './coastal-contact-visual.js';
import {createCoastalFarBatches} from './coastal-far-batches.js';
const THREE=await import('../dist/coastal-contact-r2/tidelands-local/vendor/three.module.min.js');
export {prepareCoastalVisual};
export function bindCoastalVisual(view,prepared){
  const original=bindOriginal(view,prepared),far=createCoastalFarBatches(THREE,view.scene,original.trees);
  return {...original,farBatches:far.batches,update(state){
    original.update(state);far.update();
    // Source cards still provide exact parent transforms; only the batch draws.
    for(const tree of original.trees)tree.far.visible=false;
  },release(){far.release();original.release();}};
}
