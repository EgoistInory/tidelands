// Evidence guards for response-only camera QA; no browser or game state mutation.
import assert from 'node:assert/strict';
import {restore,serialize} from '../src/game.js';
export function guardCameraQaRoute(handler,errors){
 return async route=>{try{return await handler(route);}catch(error){errors.push('QA route failure: '+String(error.message??error));try{await route.abort();}catch(abortError){errors.push('QA route abort failure: '+String(abortError.message??abortError));}}};
}
export function assertCameraRestoreEvidence({startLabel,loadStatus,exported},saved){
 assert.equal(startLabel,'继续旅程','restore must enable continuing the actual saved journey');
 assert(!/未能读取|准备失败|重新加载/.test(loadStatus),'restore failure notice is not a successful load');
 assert.deepEqual(JSON.parse(exported),JSON.parse(serialize(restore(saved))),'paused live export must reproduce the entire canonical restored state');
}
