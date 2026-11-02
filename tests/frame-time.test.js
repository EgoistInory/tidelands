import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshGame,movePlayer,tick} from '../src/game.js';

// Exercise the actual production callback's timing prelude without a browser clock injection.
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const prelude=source.match(/function frame\(now\)\{([\s\S]*?)let moving=false;/)?.[1];
assert(prelude,'production frame timing prelude must be available');
const frameTime=new Function('now','last',prelude+'return {dt,last};');

test('a callback timestamp before the start barrier cannot reverse world time, walking or stamina',()=>{
  const state=freshGame(),before=structuredClone(state),step=frameTime(990,1000);
  movePlayer(state,[],0,1,step.dt,false);tick(state,step.dt,false);
  assert(state.time>=before.time,'stale frame must not run simulation backwards');
  assert(state.player.z>=before.player.z,'stale frame must not move against input');
  assert(state.player.stamina>=before.player.stamina,'idle recovery cannot drain stamina');
  assert(step.last>=1000,'a stale timestamp must not move the start barrier backwards');
});
test('ordinary frames retain elapsed simulation time and long frames retain the existing 50ms cap',()=>{
  assert.deepEqual(frameTime(1016,1000),{dt:.016,last:1016});
  assert.deepEqual(frameTime(1250,1000),{dt:.05,last:1250});
});
