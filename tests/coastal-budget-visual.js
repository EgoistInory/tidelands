import {prepareCoastalVisual,bindCoastalVisual as bindOriginal} from './coastal-contact-visual.js';
import {createCoastalFarBatches} from './coastal-far-batches.js';
import {coastalBudgetLevels} from './coastal-level-budget.js';
import * as THREE from '../dist/coastal-contact-r2/tidelands-local/vendor/three.module.min.js';
import {isDepleted} from '../dist/coastal-contact-r2/tidelands-local/src/game.js';
export {prepareCoastalVisual};
export function bindCoastalVisual(view,prepared){
  const original=bindOriginal(view,prepared),far=createCoastalFarBatches(THREE,view.scene,original.trees);
  return {...original,farBatches:far.batches,update(state){
    original.update(state);
    const depleted=new Set(original.trees.filter(t=>isDepleted(state,t.node)).map(t=>t.node.id));
    const levels=new Map(coastalBudgetLevels(original.trees.map(t=>t.node),state.player,depleted).map(r=>[r.id,r.level]));
    for(const tree of original.trees){tree.level=levels.get(tree.node.id);tree.root.visible=tree.level!=='hidden';for(const k of ['near','mid','far'])tree[k].visible=k===tree.level;}
    far.update();for(const tree of original.trees)tree.far.visible=false;
  },release(){far.release();original.release();}};
}
