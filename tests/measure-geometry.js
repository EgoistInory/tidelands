// CPU-side geometry storage, not total JS heap or GPU memory.
import * as THREE from '../vendor/three.module.min.js';
import {WorldView} from '../src/scene.js';
import {createWorld} from '../src/world.js';
import {createCreature} from '../src/creature.js';
const world=createWorld(),view={world,scene:new THREE.Scene()};
WorldView.prototype.createScenery.call(view);
const cache=new Map();
for(const enemy of world.enemies)view.scene.add(createCreature(enemy.type,cache));
const arrays=new Set();let meshes=0;
view.scene.traverse(o=>{
  if(!o.isMesh)return;meshes++;
  for(const attribute of Object.values(o.geometry.attributes))arrays.add(attribute.array);
  if(o.geometry.index)arrays.add(o.geometry.index.array);
  if(o.instanceMatrix)arrays.add(o.instanceMatrix.array);
});
console.log(JSON.stringify({scope:'scenery and all creatures; excludes player, terrain, water',meshes,typedArrayBytes:[...arrays].reduce((n,a)=>n+a.byteLength,0)},null,2));
