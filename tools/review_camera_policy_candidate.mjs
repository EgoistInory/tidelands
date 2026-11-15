// Explicit frozen actual-input replay. Foreground fade is settled separately; no native-play claim.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),out=process.argv[2]??'dist/camera-policy-candidate-2026-11-15';assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const data=JSON.parse(fs.readFileSync('docs/settlement-forest-2026-11-15/camera-input-cases.json')),history=JSON.parse(fs.readFileSync('dist/settlement-forest-journey-390-r2-2026-11-15/raw.json')),sha=b=>createHash('sha256').update(b).digest('hex');
const report={complete:false,rows:[],logs:[],source:Object.fromEntries(['tools/camera_controller_candidate.js','tools/camera_occlusion_candidate.js'].map(p=>[p,sha(fs.readFileSync(p))])),scope:'Declared QA replay of captured player position/time and complete camera inputs with independently restored closest phase save. Actor bone history is not reproduced. Frozen first-step camera comparison; foreground visibility settled without advancing game time. Not ordinary movement, continuous camera or production acceptance.'};
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{for(const width of [1280,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:800}});await context.route('**/*',r=>{
  const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:4190')return r.abort();
  if(u.pathname==='/src/scene.js'){
   let code=fs.readFileSync('src/scene.js','utf8');code="import {followCameraCandidate} from '/tools/camera_controller_candidate.js';import {prepareCameraOccluder,createForegroundFade} from '/tools/camera_occlusion_candidate.js';\n"+code;
   const marker='    const safe=unobstructedCamera(',start=code.indexOf(marker),end=code.indexOf('    // A retracted camera',start);assert(start>0&&end>start);
   code=code.slice(0,start)+`    const field=window.cameraPolicyField,active=window.cameraPolicyActive;
    const f=field?new THREE.Vector3(...field.focus):focus,old=field?new THREE.Vector3(...field.current):this.camera.position.clone(),goal=field?new THREE.Vector3(...field.desired):target,obstacles=field?field.boxes.map(([a,b])=>new THREE.Box3(new THREE.Vector3(...a),new THREE.Vector3(...b))):boxes,interval=field?field.dt:dt;
    this.cameraFade??=createForegroundFade();
    if(active){this.cameraRoute??={};const result=followCameraCandidate(f,old,goal,obstacles,terrain,interval,this.cameraRoute);this.camera.position.copy(result.position);this.cameraPolicyResult={...result,position:result.position.toArray()};
     const actors=new Set([this.player,this.woodlandDressing?.root,...this.islanders.map(r=>r.model),...this.creatures.values()]);
     for(const root of this.scene.children)if(root.isGroup&&!actors.has(root))prepareCameraOccluder(root);
     for(const r of this.batches)prepareCameraOccluder(r.batch);for(const batch of this.coastal?.farBatches??[])prepareCameraOccluder(batch);for(const t of this.inland?.trees??[])prepareCameraOccluder(t.far);
     const body=f.clone();body.y-=1;this.cameraFade.update(body,this.camera.position,result.occluded,interval);
    }else{this.cameraFade.reset();const safe=unobstructedCamera(f,goal,obstacles,terrain,6,Math.atan2(old.x-f.x,old.z-f.z));this.camera.position.copy(smoothCamera(f,old,safe,obstacles,terrain,interval,Math.min(6,safe.distanceTo(f))));}
`+code.slice(end);return r.fulfill({contentType:'text/javascript',body:code});
  }
  if(u.pathname==='/tests/regional-landform-review.html')return r.fulfill({contentType:'text/html',body:fs.readFileSync('tests/regional-landform-review.html','utf8').replace('window.regionalReview={reset,snapshot,move,sites};','window.regionalReview={reset,snapshot,move,sites,view,world,THREE};')});return r.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.logs.push(e.message));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push(e.text());});await page.goto('http://127.0.0.1:4190/tests/regional-landform-review.html');await page.waitForFunction(()=>!!window.regionalReview);
 for(const c of data.cases){const phase=[...history.phases].reverse().find(p=>p.time<=c.time)??history.phases[0],save=JSON.parse(fs.readFileSync(path.join('dist/settlement-forest-journey-390-r2-2026-11-15',phase.save)));
  for(const active of [false,true]){
   const row=await page.evaluate(({c,save,active})=>{const {view,world,THREE}=window.regionalReview,original=JSON.stringify(world);Object.assign(save.player,{x:c.after[3],z:c.after[4]});save.time=c.time;const stateBefore=JSON.stringify(save);window.cameraPolicyField=c.input;window.cameraPolicyActive=active;view.cameraRoute={};view.sync(save);view.player.userData.lastPosition=null;view.camera.position.fromArray(c.input.current);view.draw(save,null,null,true,c.input.dt);
    if(active){const body=new THREE.Vector3(...c.input.focus);body.y-=1;for(let n=0;n<24;n++)view.cameraFade.update(body,view.camera.position,view.cameraPolicyResult.occluded,1/60);}
    view.finish.render(view.scene,view.camera);const bounds=new THREE.Box3(),p=new THREE.Vector3();let vertices=0;view.player.traverse(m=>{if(!m.isMesh)return;for(let a=m;a;a=a.parent)if(!a.visible)return;for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,p);p.applyMatrix4(m.matrixWorld).project(view.camera);bounds.expandByPoint(p);vertices++;}});
    document.querySelector('#status').textContent=active?'连接路径与前景淡出候选':'原生产策略';document.querySelector('#result').textContent=JSON.stringify({scope:'Frozen actual-input QA replay, settled fade; not ordinary play',frame:c.frame,player:[save.player.x,save.player.z],time:save.time,camera:view.camera.position.toArray()});
    const position=view.camera.position.toArray(),old=Math.atan2(c.before[13]-c.before[3],c.before[15]-c.before[4]),next=Math.atan2(position[0]-save.player.x,position[2]-save.player.z);
    return {active,frame:c.frame,position,turnDegrees:Math.abs(Math.atan2(Math.sin(next-old),Math.cos(next-old)))*180/Math.PI,inside:c.input.boxes.some(([a,b])=>new THREE.Box3(new THREE.Vector3(...a),new THREE.Vector3(...b)).containsPoint(view.camera.position)),stateUnchanged:JSON.stringify(save)===stateBefore,worldUnchanged:JSON.stringify(world)===original,glError:view.renderer.getContext().getError(),fade:view.cameraFade.amount,bodyProjection:{min:bounds.min.toArray(),max:bounds.max.toArray(),vertices},policy:active?view.cameraPolicyResult:null};
   },{c,save,active});assert(row.stateUnchanged&&row.worldUnchanged&&row.glError===0);if(active)assert(!row.inside&&row.turnDegrees<8);const image=`${width}-${c.frame}-${active?'candidate':'baseline'}.jpg`;await page.screenshot({path:path.join(out,image),type:'jpeg',quality:87});report.rows.push({width,...row,image,sha256:sha(fs.readFileSync(path.join(out,image)))});
  }
 }
 assert.equal(await page.evaluate(()=>localStorage.length),0);await context.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({width,rows:report.rows.length}));
}assert.deepEqual(report.logs,[]);report.complete=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.stack);}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
