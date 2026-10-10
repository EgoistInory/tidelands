import {mkdirSync,writeFileSync} from 'node:fs';
import {freshGame,canBuild} from '../src/game.js';
import {createWorld} from '../src/world.js';
const world=createWorld(),state=freshGame();
Object.assign(state.inventory,{wood:40,stone:30,fiber:15,crystal:8});state.quest=1;state.player.hp=60;
let placed=false;
for(let x=-110;x<-40&&!placed;x+=3)for(let z=60;z<120&&!placed;z+=3){state.player.x=x;state.player.z=z-6;state.player.yaw=0;if(!canBuild(state,world.objects,'campfire',x,z))placed=true;}
if(!placed)throw new Error('No valid fixture build location');
mkdirSync(new URL('./fixtures/',import.meta.url),{recursive:true});
writeFileSync(new URL('./fixtures/build-ready.json',import.meta.url),JSON.stringify(state,null,2));
writeFileSync(new URL('./fixtures/invalid.json',import.meta.url),'{"version":99}');
console.log(`Build fixture ready at ${state.player.x}, ${state.player.z}`);
const finale=freshGame();finale.quest=5;finale.time=410;
Object.assign(finale.inventory,{wood:12,stone:8,crystal:3});
Object.assign(finale.player,{x:-93,z:-48,yaw:Math.PI});
for(const enemy of finale.enemies)enemy.hp=0;
writeFileSync(new URL('./fixtures/lighthouse-ready.json',import.meta.url),JSON.stringify(finale,null,2));
