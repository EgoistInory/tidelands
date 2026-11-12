import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const out='dist/combat-contacts-2026-11-12';assert(!fs.existsSync(out));fs.mkdirSync(out);
const base='dist/tidelands-m5-2026-11-05-camera-orbit-r2/tidelands-local';
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try{const context=await browser.newContext({storageState:'dist/combat-height-downhill-2026-11-12-combat/browser-state.json'});
await context.route('**/src/scene.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(base+'/src/scene.js','utf8')+`
import {footprintBoxes as diagnosticBoxes} from './resource-footprint.js';
const originalDiagnosticDraw=WorldView.prototype.draw;
WorldView.prototype.draw=function(state,...args){const result=originalDiagnosticDraw.call(this,state,...args);window.inspectContacts=()=>({yaw:this.yaw,player:{...state.player},enemies:structuredClone(state.enemies),objects:this.world.objects.filter(o=>Math.hypot(o.x-state.player.x,o.z-state.player.z)<20).map(o=>({...o,boxes:diagnosticBoxes(o)}))});return result;};`}));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4190/'+base+'/');await page.waitForFunction(()=>!document.querySelector('#start-button').disabled);await page.click('#start-button');await page.waitForFunction(()=>!!window.inspectContacts);await page.click('#pause-button');const result=await page.evaluate(()=>window.inspectContacts());result.errors=errors;fs.writeFileSync(out+'/actual.json',JSON.stringify(result,null,2));assert.equal(errors.length,0);console.log(JSON.stringify({yaw:result.yaw,player:result.player,objects:result.objects.length}));await context.close();}finally{await browser.close();}
