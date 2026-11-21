import {test} from 'node:test';import assert from 'node:assert/strict';
import {installJourneyProbe} from '../tools/journey_frame_probe.js';
function fixture(){
 const events=[],batches=[],gl={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2,QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension(){return this;},getError:()=>0,createQuery:()=>({}),beginQuery(){events.push('begin');},endQuery(){events.push('end');},deleteQuery(){events.push('delete');},getParameter:()=>false,getQueryParameter:(q,p)=>p===3?true:12000000};
 const view={canvas:{width:1280,height:800,addEventListener(){}},camera:{position:{toArray:()=>[1,2,3]}},yaw:.15,pitch:.29,distance:14,renderer:{getContext:()=>gl,info:{render:{calls:0,triangles:0},memory:{geometries:3,textures:4},programs:[]},render(label){events.push(label);this.info.render={calls:label==='world'?3:1,triangles:label==='world'?100:2};}}};
 return {events,batches,view};
}
test('one GPU interval includes the world and every HDR pass and totals their real render counts',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window={};globalThis.document={hidden:false};globalThis.innerWidth=1280;globalThis.innerHeight=800;
 try{
  const {events,batches,view}=fixture(),original=view.renderer.render,p=installJourneyProbe(view,b=>batches.push(b)),s={time:2,player:{x:0,z:0,hp:100}},saved=JSON.stringify(s);
  window.journeyProbe.start();p.draw(()=>{for(const label of ['world','bright','blur','finish'])view.renderer.render(label);},s,true,.016);
  assert.deepEqual(events.slice(0,6),['begin','world','bright','blur','finish','end']);
  const status=await window.journeyProbe.stop();assert.equal(view.renderer.render,original);assert.equal(status.frames,1);assert.equal(status.issued,status.deleted);assert.equal(JSON.stringify(s),saved);
  const row=batches.flatMap(b=>b.frames)[0];assert.equal(row[10],6);assert.equal(row[11],106);assert.equal(row[12],4);assert.deepEqual(row.slice(13,16),[1,2,3]);assert.deepEqual(row.slice(16),[.016,.15,.29,14]);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;delete globalThis.innerWidth;delete globalThis.innerHeight;}
});
test('throwing draw closes the full interval and preserves its error; stop is idempotent',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window={};globalThis.document={hidden:false};globalThis.innerWidth=1280;globalThis.innerHeight=800;
 try{
  const {events,view}=fixture(),p=installJourneyProbe(view,()=>{});window.journeyProbe.start();
  assert.throws(()=>p.draw(()=>{view.renderer.render('world');throw Error('original failure');},{time:0,player:{x:0,z:0,hp:100}},false),/original failure/);
  assert(events.indexOf('end')>events.indexOf('world'));await window.journeyProbe.stop();const count=events.length;await window.journeyProbe.stop();assert.equal(events.length,count);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;delete globalThis.innerWidth;delete globalThis.innerHeight;}
});
test('resource-only sampling never makes a synchronous WebGL error query',async()=>{
 const saved={window:globalThis.window,document:globalThis.document,innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight};
 Object.assign(globalThis,{window:{},document:{hidden:false},innerWidth:1280,innerHeight:800});
 try{
  const {view,batches}=fixture(),gl=view.renderer.getContext();
  gl.getError=()=>assert.fail('Synchronous query in the measured frame');
  const p=installJourneyProbe(view,b=>batches.push(b),{sampleGlErrors:false});
  window.journeyProbe.start();p.draw(()=>view.renderer.render('world'),{time:2,player:{x:0,z:0,hp:100}},true);
  await window.journeyProbe.stop();
  const [resources]=batches.flatMap(b=>b.resources);
  assert.equal(resources.textures,4);
  assert.equal(resources.glError,null);
 }finally{Object.assign(globalThis,saved);}
});
test('full-frame streaming caps batches and in-flight sends rather than retaining an unbounded movie',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window={};globalThis.document={hidden:false};globalThis.innerWidth=1280;globalThis.innerHeight=800;
 try{
  const {view,batches}=fixture(),p=installJourneyProbe(view,b=>batches.push(b));window.journeyProbe.start();
  for(let i=0;i<901;i++)p.draw(()=>view.renderer.render('world'),{time:i/60,player:{x:0,z:0,hp:100}},true);
  const status=await window.journeyProbe.stop();assert.equal(status.peakInflight,4);assert.equal(status.dropped,181);assert.equal(status.bufferedFrames,0);assert.equal(status.issued,status.deleted);assert(batches.every(b=>b.frames.length<=180));
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;delete globalThis.innerWidth;delete globalThis.innerHeight;}
});
test('large turns preserve the actual draw inputs instead of guessing them from later screenshots',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window={};globalThis.document={hidden:false};globalThis.innerWidth=1280;globalThis.innerHeight=800;
 try{
  const {view,batches}=fixture();let camera=[0,2,10];view.camera.position.toArray=()=>[...camera];const vector=a=>({toArray:()=>[...a]});
  const p=installJourneyProbe(view,b=>batches.push(b)),state={time:1,player:{x:0,z:0,hp:100}};window.journeyProbe.start();p.draw(()=>view.renderer.render('world'),state,true,.016);
  view.__journeyCameraInput={focus:vector([0,2,0]),current:vector(camera),desired:vector([0,3,10]),dt:.017,boxes:[{min:vector([-1,0,2]),max:vector([1,4,3])}]};camera=[0,2,-10];state.time+=.017;p.draw(()=>view.renderer.render('world'),state,true,.017);
  const status=await window.journeyProbe.stop(),cases=batches.flatMap(b=>b.cameraCases);assert.equal(status.capturedCameraCases,1);assert.equal(status.cameraCasesDropped,0);assert.equal(cases[0].degrees,180);assert.equal(cases[0].input.dt,.017);assert.deepEqual(cases[0].input.current,[0,2,10]);assert.deepEqual(cases[0].input.boxes,[[[-1,0,2],[1,4,3]]]);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;delete globalThis.innerWidth;delete globalThis.innerHeight;}
});
