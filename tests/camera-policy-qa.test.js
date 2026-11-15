import test from 'node:test';import assert from 'node:assert/strict';
import {guardCameraQaRoute,assertCameraRestoreEvidence} from '../tools/camera_policy_qa.mjs';
import {cameraPolicyScene} from '../tools/camera_policy_scene_candidate.mjs';
import {freshGame,serialize,restore} from '../src/game.js';
test('response patch failure aborts the request and is recorded rather than escaping its event callback',async()=>{
 const errors=[];let aborted=0;const route={abort:async()=>{aborted++;}};
 await guardCameraQaRoute(()=>cameraPolicyScene('missing scene splice markers'),errors)(route);assert.equal(aborted,1);assert.equal(errors.length,1);assert.match(errors[0],/markers changed/);
});
test('an abort rejection is also recorded and successful responses retain their return value',async()=>{
 const errors=[];await guardCameraQaRoute(async()=>{throw Error('fixture read failed');},errors)({abort:async()=>{throw Error('request closed');}});assert.equal(errors.length,2);
 assert.equal(await guardCameraQaRoute(async()=>42,errors)({}),42);
});
test('matching stored bytes cannot validate a restored fresh game export',()=>{
 const s=freshGame();s.quest=6;s.kills=22;const saved=serialize(s),exported=serialize(freshGame());assert.throws(()=>assertCameraRestoreEvidence({startLabel:'继续旅程',loadStatus:'群岛已就绪',exported},saved));
});
test('restore acceptance requires the continue state, no read failure and exact live export',()=>{
 const saved=serialize(freshGame()),good={startLabel:'继续旅程',loadStatus:'群岛已就绪',exported:serialize(restore(saved))};assertCameraRestoreEvidence(good,saved);assert.throws(()=>assertCameraRestoreEvidence({...good,startLabel:'开始旅程'},saved));assert.throws(()=>assertCameraRestoreEvidence({...good,loadStatus:'旧存档未能读取'},saved));
});

test('the documented restore cooldown reset is compared canonically while real progress still must match',()=>{
 const state=freshGame();state.quest=6;state.kills=22;state.interactAt=state.time;const saved=serialize(state),exported=serialize(restore(saved));assertCameraRestoreEvidence({startLabel:'继续旅程',loadStatus:'群岛已就绪',exported},saved);const damaged=JSON.parse(exported);damaged.kills=0;assert.throws(()=>assertCameraRestoreEvidence({startLabel:'继续旅程',loadStatus:'群岛已就绪',exported:JSON.stringify(damaged)},saved));
});
