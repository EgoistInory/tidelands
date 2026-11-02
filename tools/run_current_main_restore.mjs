// Isolated copy of the historical ordinary export, exercised through production UI only.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright'),root=fileURLToPath(new URL('..',import.meta.url)),out=path.resolve(process.argv[2]??path.join(root,'dist/current-main-restore-2026-11-02'));
const baseUrl=new URL(process.env.TIDELANDS_BASE_URL??'http://127.0.0.1:4190/');assert.equal(baseUrl.origin,'http://127.0.0.1:4190');
assert(!fs.existsSync(out),'Preserve previous evidence; choose another output directory.');fs.mkdirSync(out,{recursive:true});
const backupPath=path.join(root,'docs/beacon-footing-normal-save.json'),backupBytes=fs.readFileSync(backupPath),backup=JSON.parse(backupBytes),sha=b=>createHash('sha256').update(b).digest('hex');
const sources=Object.fromEntries(['src/main.js','src/world.js','src/inland.js','src/terrain-composition.js'].map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']}),report={entry:baseUrl.href,runtimeOutsideBase:[],sources,backupSha256:sha(backupBytes),logs:[],rows:[],scope:'Historical ordinary export copied into an isolated browser profile. Native production start/move/pause/save/reload; does not advance the original browser save or prove a new ordinary campaign, full quality, performance or device acceptance.'};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1.5});
 await context.addInitScript(raw=>{if(!sessionStorage.getItem('restore-copy-seeded')){localStorage.setItem('tidelands-save-v1',raw);sessionStorage.setItem('restore-copy-seeded','1');}},backupBytes.toString());
 await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4190'?route.continue():route.abort());
 const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.logs.push({type:'pageerror',message:e.message}));page.on('console',e=>{if(['warning','error'].includes(e.type()))report.logs.push({type:e.type(),message:e.text()});});
 page.on('request',r=>{const url=new URL(r.url());if(/\.(?:js|glb|gltf|bin|png|jpg|json)$/.test(url.pathname)&&!url.pathname.startsWith(baseUrl.pathname))report.runtimeOutsideBase.push(url.href);});
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tidelands-save-v1')));
 async function ready(){await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);const text=await page.locator('#load-status').textContent();assert.equal(text,'群岛已就绪 · 无需联网');}
 async function photo(name){const image=name+'.png';await page.screenshot({path:path.join(out,image)});return {image,sha256:sha(fs.readFileSync(path.join(out,image))),viewport:page.viewportSize(),canvas:await page.locator('#world').evaluate(c=>[c.width,c.height])};}
 await page.goto(baseUrl.href);await ready();assert.deepEqual(await stored(),backup);console.log('Original copy and all production authored modules ready.');
 await page.click('#start-button');report.rows.push({phase:'desktop-before',...(await photo('desktop-before'))});
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();const saved=await stored();
 report.distance=Math.hypot(saved.player.x-backup.player.x,saved.player.z-backup.player.z);assert(report.distance>1,'native input must move');
 for(const field of ['inventory','buildings','quest','kills'])assert.deepEqual(saved[field],backup[field]);assert.equal(saved.player.hp,backup.player.hp);
 await page.reload();await ready();assert.deepEqual(await stored(),saved);report.rows.push({phase:'desktop-reloaded',state:await stored()});
 await page.setViewportSize({width:390,height:844});await page.reload();await ready();assert.deepEqual(await stored(),saved);await page.click('#start-button');report.rows.push({phase:'mobile-restored',...(await photo('mobile-restored'))});
 await page.click('#pause-button');await page.getByRole('button',{name:'保存进度',exact:true}).click();const mobileSaved=await stored();for(const field of ['player','inventory','buildings','depleted','quest','kills','respawn','discovered','selected'])assert.deepEqual(mobileSaved[field],saved[field]);
 await page.reload();await ready();assert.deepEqual(await stored(),mobileSaved);report.mobileReloadExact=true;report.complete=true;report.savedState=saved;report.mobileSavedState=mobileSaved;report.cleanConsole=report.logs.length===0;assert(report.cleanConsole);assert.equal(report.runtimeOutsideBase.length,0);assert.equal(sha(fs.readFileSync(backupPath)),report.backupSha256);
 console.log(JSON.stringify({complete:true,distance:report.distance,mobileReloadExact:true,cleanConsole:true,out}));
}catch(error){report.error=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
