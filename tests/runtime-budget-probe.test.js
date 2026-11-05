import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TimerPool,installBudgetProbe} from '../tools/runtime_budget_probe.js';
function mock(){let available=false,disjoint=false,deleted=0,ends=0;return {TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2,QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,createQuery:()=>({}),beginQuery(){},endQuery(){ends++;},deleteQuery(){deleted++;},getParameter:()=>disjoint,getQueryParameter:(q,p)=>p===3?available:12000000,setAvailable(v){available=v;},setDisjoint(v){disjoint=v;},counts:()=>({deleted,ends})};}
test('native timing keeps at most one pending query and deletes completed queries',()=>{
 const gl=mock(),p=new TimerPool(gl,gl);assert.equal(p.begin(1,0,0),false);assert(p.begin(8,2,100));p.end();assert.equal(p.begin(16,2,110),false);assert.equal(p.poll(120),null);gl.setAvailable(true);assert.deepEqual(p.poll(130),{frame:8,time:2,ms:12,latencyMs:30});assert.deepEqual(gl.counts(),{deleted:1,ends:1});assert(p.begin(24,3,140));p.close();assert.equal(p.stats().issued,p.stats().deleted);
});
test('disjoint and timed-out queries are discarded; unsupported extension never starts queries',()=>{
 const gl=mock(),p=new TimerPool(gl,gl);p.begin(0,0,0);p.end();gl.setDisjoint(true);assert.equal(p.poll(10),null);assert.equal(p.stats().disjointFrames,1);gl.setDisjoint(false);p.begin(8,0,20);p.end();p.poll(10021);assert.equal(p.stats().timeouts,1);assert.equal(p.stats().deleted,2);const absent=new TimerPool(gl,null);assert.equal(absent.begin(0,0,0),false);absent.close();assert.equal(absent.stats().issued,0);
});
test('streaming bounds observation memory, reports backpressure, and stops issuing queries',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window={};globalThis.document={hidden:false};
 try{
  const gl=mock();gl.getExtension=()=>gl;gl.getError=()=>0;
  globalThis.window.innerWidth=1280;globalThis.window.innerHeight=800;
  // Browser globals resolve these directly, unlike this Node test environment.
  globalThis.innerWidth=1280;globalThis.innerHeight=800;
  const view={canvas:{width:1280,height:800,addEventListener(){}},renderer:{getContext:()=>gl,render(){},info:{render:{calls:1,triangles:2},memory:{geometries:3,textures:4},programs:[]}}},batches=[];
  const p=installBudgetProbe(view,b=>{batches.push(b);}),draw=()=>view.renderer.render();p.draw(draw,{time:0,player:{x:0,z:0,hp:100}},false);assert.equal(gl.counts().ends,0);
  window.runtimeBudget.start();for(let i=0;i<901;i++)p.draw(draw,{time:i*.01,player:{x:i,z:0,hp:100}},true);
  const stopped=await window.runtimeBudget.stop();assert.equal(stopped.peakInflight,4);assert.equal(stopped.bufferedFrames,0);assert.equal(stopped.dropped,181);assert.equal(stopped.issued,stopped.deleted);assert(batches.every(b=>b.frames.length<=180));const before=gl.counts();p.draw(draw,{time:10,player:{x:0,z:0,hp:100}},false);assert.deepEqual(gl.counts(),before);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;delete globalThis.innerWidth;delete globalThis.innerHeight;}
});
