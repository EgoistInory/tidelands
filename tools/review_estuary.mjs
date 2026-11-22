// Same playable-region cameras at the crossing, landing and sheltered ascent.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {guardCameraQaRoute} from './camera_policy_qa.mjs';

const {chromium} = await import(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const [output, route] = process.argv.slice(2);
const shoal = route === '--shoal';
assert(output && !fs.existsSync(output));
fs.mkdirSync(output, {recursive: true});
const origin = 'http://127.0.0.1:4190';
const baseline = shoal ? 'cd0538f3c82279d99ecdd594b850e48f3db2d1bb' : 'd700ce0b610e80cf63dc7c2c710d5ab13de01175';
const files = ['src/landscape.js', 'src/meadow.js'];
const old = new Map(files.map(file => ['/' + file, execFileSync('git', ['show', `${baseline}:${file}`], {encoding: 'utf8'})]));
const sha = data => createHash('sha256').update(data).digest('hex');
const habitatFile = shoal ? 'src/shoal-habitat.js' : 'src/estuary-habitat.js';
const report = {complete: false, baseline, rows: [], logs: [], source: Object.fromEntries([...files, habitatFile].map(file => [file, sha(fs.readFileSync(file))])), scope: 'Declared positions and times, HDR, no storage or ordinary gameplay claim'};
const html = fs.readFileSync('tests/regional-landform-review.html', 'utf8')
  .replace('coast:[-130,20],forest:[164.4377,-108.4654],highland:[-41.4534111,-208.3750763]',
    shoal ? 'coast:[81,134],forest:[92,141],highland:[110,159]' : 'coast:[55,-18],forest:[76,-19],highland:[106,-23]')
  .replace('near:[7,6,8],middle:[25,18,28]', 'near:[-12,5,4],middle:[-23,11,8]')
  .replace('h+1,z);saved', 'h+2,z);saved')
  .replace('state.time=240', 'state.time=Number(document.body.dataset.time||240)')
  .replace('window.regionalReview={reset,snapshot,move,sites};', 'window.regionalReview={reset,snapshot,move,sites,view};')
  .replace('四岛同镜头 · 无存档的声明fixture', '渡口／登陆／上坡 · 同镜头')
  .replace('潮汐海岸</option>', '渡口</option>').replace('苍翠林地</option>', '登陆岸</option>')
  .replace('雾岬高地</option>', shoal ? '沙丘内侧</option>' : '林缘上坡</option>');
const browser = await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal']});
try {
  for (const width of [1280,390]) for (const variant of ['before','after']) {
    const context = await browser.newContext({viewport:{width,height:width===390?844:800}});
    try {
      await context.route('**/*', guardCameraQaRoute(route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/tests/regional-landform-review.html') return route.fulfill({body:html,contentType:'text/html'});
        if (variant === 'before' && old.has(url.pathname)) return route.fulfill({body:old.get(url.pathname),contentType:'text/javascript'});
        return route.continue();
      },report.logs));
      const page = await context.newPage();
      page.on('pageerror', error => report.logs.push(error.message));
      page.on('console', event => {if (['warning','error'].includes(event.type())) report.logs.push(event.text());});
      await page.goto(origin+'/tests/regional-landform-review.html');
      await page.waitForFunction(() => window.regionalReview, undefined, {timeout:90000});
      for (const [site,time] of [['coast',240],['forest',240],['highland',240],['forest',30]]) {
        const row = await page.evaluate(({site,time}) => {
          document.body.dataset.time=time;
          const {view,reset}=window.regionalReview, renderer=view.renderer;
          const draw=renderer.render, passes=[];
          renderer.render=function(...args) {
            draw.apply(this,args);
            passes.push({calls:this.info.render.calls,triangles:this.info.render.triangles});
          };
          try {
            const snapshot=reset(site,site==='coast'?'middle':'near');
            return {...snapshot,hdr:!!view.finish,fixedPasses:passes.slice(view.finish?-4:-1)};
          } finally {renderer.render=draw;}
        }, {site,time});
        assert(row.worldUnchanged && row.stateUnchanged && row.glError === 0 && row.hdr && row.fixedPasses.length===4 && row.fixedPasses[0].calls>1);
        const image = `${width}-${variant}-${site}-${time}.jpg`;
        await page.screenshot({path:path.join(output,image),type:'jpeg',quality:87});
        report.rows.push({width,variant,...row,image,sha256:sha(fs.readFileSync(path.join(output,image)))});
      }
      assert.equal(await page.evaluate(() => localStorage.length),0);
    } finally {await context.close();}
  }
  for (const after of report.rows.filter(row => row.variant==='after')) {
    const before=report.rows.find(row => row.variant==='before' && row.width===after.width && row.site===after.site && row.time===after.time);
    assert.deepEqual(after.camera,before.camera);
    assert.deepEqual(after.lookAt,before.lookAt);
  }
  assert.deepEqual(report.logs,[]);
  report.complete=true;
} catch (error) {report.error=error.stack;process.exitCode=1;console.error(error);}
finally {try {await browser.close();} finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}}
