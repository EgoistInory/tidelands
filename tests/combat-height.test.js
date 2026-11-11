import test from 'node:test';
import assert from 'node:assert/strict';
import {freshGame,attack,tick} from '../src/game.js';
// Positions captured during native damage, not the later post-combat save.
function setup(){const s=freshGame();s.player.x=-112.66310853780107;s.player.z=-227.59417505045906;s.player.yaw=Math.atan2(-114.78069271118233-s.player.x,-228.50791425102648-s.player.z);s.selected='axe';s.inventory.axe=1;s.time=1400;s.enemies=[{id:'enemy-10',type:'crab',x:-114.78069271118233,z:-228.50791425102648,hp:40,attackAt:0}];return s;}
test('native cliff-separated target cannot receive a planar melee hit',()=>{const s=setup();assert.deepEqual(attack(s).hits,[]);assert.equal(s.enemies[0].hp,40);});
test('native cliff-separated crab cannot damage player during windup',()=>{const s=setup();for(let i=0;i<60;i++)tick(s,1/60);assert.equal(s.player.hp,100);});
