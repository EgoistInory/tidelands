// Declared restored/reposed QA motion and complete HDR cost. No localStorage or ordinary-save claim.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {cameraPolicyScene} from './camera_policy_scene_candidate.mjs';
import {guardCameraQaRoute} from './camera_policy_qa.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),out=process.argv[2]??'dist/camera-policy-motion-2026-11-15';assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),data=JSON.parse(fs.readFileSync('docs/settlement-forest-2026-11-15/camera-input-cases.json')),history=JSON.parse(fs.readFileSync('dist/settlement-forest-journey-390-r2-2026-11-15/raw.json'));
const report={complete:false,rows:[],logs:[],source:Object.fromEntries(['tools/camera_controller_candidate.js','tools/camera_occlusion_candidate.js','tools/camera_policy_scene_candidate.mjs','tools/review_camera_policy_motion.mjs'].map(p=>[p,sha(fs.readFileSync(p))])),scope:'Browser plugin not available; installed headless Metal Playwright. Declared no-storage restored phase saves, reposed to captured positions and times. Native movePlayer/tick with fixed1/60 simulation step and rAF rendering, manual orbit request. Complete HDR draw timer queries. Not ordinary file import, real devices, long-run or final camera quality acceptance.'};
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{for(const width of [1280,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:800},recordVideo:{dir:out,size:{width,height:width===390?844:800}}});
 await context.route('**/*',guardCameraQaRoute(r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:4190')return r.abort();
  if(u.pathname==='/src/scene.js')return r.fulfill({contentType:'text/javascript',body:cameraPolicyScene(fs.readFileSync('src/scene.js','utf8'))});
  if(u.pathname==='/tests/regional-landform-review.html')return r.fulfill({contentType:'text/html',body:fs.readFileSync('tests/regional-landform-review.html','utf8').replace('window.regionalReview={reset,snapshot,move,sites};','window.regionalReview={reset,snapshot,move,sites,view,world,THREE};')});return r.continue();},report.logs));
 const page=await context.newPage(),video=page.video();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['error','warning'].includes(e.type()))report.logs.push(e.text());});await page.goto('http://127.0.0.1:4190/tests/regional-landform-review.html');await page.waitForFunction(()=>!!window.regionalReview);assert((await page.title()).includes('四岛'));
 for(const c of data.cases){const phase=[...history.phases].reverse().find(p=>p.time<=c.time)??history.phases[0],save=JSON.parse(fs.readFileSync(path.join('dist/settlement-forest-journey-390-r2-2026-11-15',phase.save)));
  for(const active of [false,true]){
   const row=await page.evaluate(async({c,save,active})=>{
    const {movePlayer,tick,nearest,serialize}=await import('/src/game.js'),{TimerPool}=await import('/tools/runtime_budget_probe.js'),{view,world,THREE}=window.regionalReview,worldBefore=JSON.stringify(world),s=structuredClone(save);
    Object.assign(s.player,{x:c.after[3],z:c.after[4]});s.time=c.time;window.cameraPolicyActive=active;view.cameraRoute={};view.cameraFade?.reset();view.sync(s);view.player.userData.lastPosition=null;view.player.userData.worldFeet=null;view.yaw=c.after[17];view.pitch=c.after[18];view.distance=c.after[19];view.camera.position.fromArray(c.input.current);
    const baseYaw=view.yaw,gl=view.renderer.getContext(),pool=new TimerPool(gl,gl.getExtension('EXT_disjoint_timer_query_webgl2')),frames=[],gpu=[],poses=[],initial=[s.player.x,s.player.z];let last=null;
    for(let n=0;n<240;n++){
     const now=await new Promise(requestAnimationFrame),old=view.camera.position.clone(),px=s.player.x,pz=s.player.z;
     const oldYaw=Math.atan2(old.x-px,old.z-pz);movePlayer(s,world.objects,n<80?0:n<160?1:0,n<80?-1:n<160?0:1,1/60,false);tick(s,1/60,true,null,world.objects);view.yaw=baseYaw+Math.max(0,n-160)/80*Math.PI*.6;
     view.sync(s);pool.begin(n,s.time,performance.now());const began=performance.now();view.draw(s,nearest(s,world.objects),null,true,1/60);const cpu=performance.now()-began;pool.end();const query=pool.poll(performance.now());if(query)gpu.push(query.ms);
     const pos=view.camera.position,angle=Math.atan2(pos.x-s.player.x,pos.z-s.player.z),p=view.cameraPolicyResult;
     frames.push({n,position:pos.toArray(),player:[s.player.x,s.player.z],turn:Math.abs(Math.atan2(Math.sin(angle-oldYaw),Math.cos(angle-oldYaw)))*180/Math.PI,shift:old.distanceTo(pos),cpu,controller:active?view.cameraPolicyCost:null,raf:last===null?null:now-last,inside:active?p.inside:null,recovered:active?p.recovered:null,terrainOccluded:active?p.terrainOccluded:null,unresolved:active?p.unresolved:null,fade:active?view.cameraFade.amount:0});last=now;
     document.querySelector('#status').textContent=(active?'候选':'生产基线')+'连续声明路径 '+c.frame+' / '+n;
     if(n%40===0||n===239){const bounds=new THREE.Box3(),v=new THREE.Vector3();let vertices=0;view.player.traverse(m=>{if(!m.isMesh)return;for(let a=m;a;a=a.parent)if(!a.visible)return;for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,v);v.applyMatrix4(m.matrixWorld).project(view.camera);bounds.expandByPoint(v);vertices++;}});poses.push({n,min:bounds.min.toArray(),max:bounds.max.toArray(),vertices,glError:gl.getError()});}
    }
    for(let i=0;i<10&&pool.pending;i++){await new Promise(requestAnimationFrame);const q=pool.poll(performance.now());if(q)gpu.push(q.ms);}pool.close();
    document.querySelector('#result').textContent=JSON.stringify({scope:'Declared continuous QA, fixed simulation step; no storage',frame:c.frame,active,player:[s.player.x,s.player.z]});
    return {active,frame:c.frame,frames,gpu,poses,timer:pool.stats(),initial,final:[s.player.x,s.player.z],worldUnchanged:JSON.stringify(world)===worldBefore,serialized:serialize(s),resources:{geometries:view.renderer.info.memory.geometries,textures:view.renderer.info.memory.textures,programs:view.renderer.info.programs.length}};
   },{c,save,active});
   assert(row.worldUnchanged);assert(row.poses.every(p=>p.glError===0));if(active){assert(row.frames.every(f=>!f.inside&&!f.recovered&&!f.terrainOccluded&&!f.unresolved&&f.shift<=14/60+1e-8&&f.turn<12));assert(row.poses.every(p=>p.min.every(v=>v>=-1)&&p.max.every(v=>v<=1)));}const image=`${width}-${c.frame}-${active?'candidate':'baseline'}.jpg`;await page.screenshot({path:path.join(out,image),type:'jpeg',quality:87});report.rows.push({width,...row,image,sha256:sha(fs.readFileSync(path.join(out,image)))});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({width,frame:c.frame,active,frames:row.frames.length,recovered:row.frames.filter(f=>f.recovered).length,maxTurn:Math.max(...row.frames.map(f=>f.turn))}));
  }
 }
 assert.equal(await page.evaluate(()=>localStorage.length),0);await context.close();const filename=await video.path();report.rows.filter(r=>r.width===width).forEach(r=>r.video=path.basename(filename));
}assert.deepEqual(report.logs,[]);report.complete=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.stack);}finally{try{await browser.close();}catch(e){report.cleanupError=e.stack;process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}}
