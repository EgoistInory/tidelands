import {actorBlocksMove} from './actor-contact.js';

// These same ground footprints place rendered columns and block moving bodies.
export const RUIN_FOOTPRINTS=Object.freeze([
  Object.freeze({x:-3.2,z:-3,radius:1.36,height:3.3}),
  Object.freeze({x:3.2,z:-3,radius:1.36,height:3.3}),
  Object.freeze({x:-4.7,z:2.6,radius:1.36,height:2.1}),
  Object.freeze({x:4.7,z:2.6,radius:1.36,height:1.4}),
  Object.freeze({x:0,z:1.6,radius:1.03,height:2.2,stele:true})
]);
export function ruinBlocksMove(from,to,origin,radius=.35){
  return RUIN_FOOTPRINTS.some(p=>actorBlocksMove(from,to,{x:origin.x+p.x,z:origin.z+p.z},radius,p.radius));
}
