"""Audit bounded native full-canvas performance; failed budgets stay failed."""
import argparse,gzip,hashlib,json,math,shutil,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'docs/runtime-budget-2026-11-05'
PACKAGE='tidelands-m5-2026-11-05-camera-orbit-r2'
DIGEST='79c84f319f64b6cf5b06c9597cdf002ea95ca5c069b8b64f042cd0e032bc7e65'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def stats(values):
 s=sorted(values)
 return {'samples':len(s),'min':s[0] if s else None,'median':s[len(s)//2] if s else None,'p95':s[int(len(s)*.95)] if s else None,'max':s[-1] if s else None}
def audit(mode,collect):
 d=ROOT/f'dist/runtime-budget-2026-11-05-{mode}';r=load(d/'raw.json');p=r['probe'];initial=ROOT/'dist/camera-orbit-r2-combat-2026-11-05'
 assert r['complete'] and r['reloadExact'] and not r['logs'] and not r.get('error') and r['respawns']==0
 assert r['packageSha256']==DIGEST and r['observerSha256']==sha(ROOT/'tools/runtime_budget_probe.js')
 assert sha(initial/'final-save.json')==r['initialSaveSha256'] and sha(initial/'browser-state.json')==r['initialProfileSha256']
 assert p['dropped']==0 and not p['errors'] and not p['hiddenFrames'] and not p['contextLost'] and p['inflight']==0 and p['bufferedFrames']==0
 assert not p['active'] and not p['pending']
 assert p['issued']==p['deleted'] and p['disjointFrames']==p['timeouts']==0 and p['peakInflight']<=4
 batches=[json.loads(line) for line in (d/'samples.jsonl').read_text().splitlines()]
 assert all(len(b['frames'])<=180 for b in batches)
 f=[v for b in batches for v in b['frames']];g=[v for b in batches for v in b['gpu']];resources=[v for b in batches for v in b['resources']]
 assert [v[0] for v in f]==list(range(p['frame'])) and len(g)==p['completed']
 assert (f[-1][1]-f[0][1])/1000>=(179 if mode=='desktop' else 89)
 assert all(math.isfinite(v) for row in f for v in row if v is not None)
 assert all(v['ms']>0 and v['frame']%8==0 and abs(v['time']-f[v['frame']][2])<1e-8 for v in g)
 assert len({v['frame'] for v in g})==len(g) and (len(g)>100 if p['supported'] else not g)
 size=[1280,800] if mode=='desktop' else [390,844]
 assert resources and all(v['viewport']==v['buffer']==size and v['glError']==0 for v in resources)
 for phase in r['phases']:
  assert phase['quest']==6 and phase['ui']['glError']==0 and not phase['ui']['hidden']
  assert phase['ui']['viewport']==phase['ui']['buffer']==size
  assert sha(d/phase['save'])==phase['saveSha256'] and sha(d/phase['image'])==phase['imageSha256']
 saved=(d/'final-save.json').read_text();final=json.loads(saved);before=r['phases'][0]
 assert final==r['final'] and final['quest']==6 and final['player']['hp']==100 and final['buildings']==before['buildings']
 assert next(v['value'] for o in load(d/'browser-state.json')['origins'] for v in o['localStorage'] if v['name']=='tidelands-save-v1')==saved
 if mode=='desktop':assert final['inventory']['crystal']>before['inventory']['crystal'] and final['kills']>before['kills']
 else:assert final['inventory']['berry']>before['inventory']['berry']
 warm=f[0][1]+10000;steady=[v for v in f if v[1]>=warm];gpu=[v['ms'] for v in g if f[v['frame']][1]>=warm]
 intervals=[v[7] for v in steady if v[7] is not None];heap=r['heap'];assert len(heap)>=(6 if mode=='desktop' else 3)
 late=[v for v in resources if v['wall']>=f[-1][1]-60000]
 phases=[]
 for a,b in zip(r['phases'],r['phases'][1:]):
  rows=[v for v in f if a['time']<=v[2]<=b['time']];gs=[v['ms'] for v in g if a['time']<=v['time']<=b['time']]
  phases.append({'from':a['name'],'to':b['name'],'frames':len(rows),'gpuMs':stats(gs),'drawCpuMs':stats([v[8] for v in rows])})
 summary={'mode':mode,'viewportAndBuffer':size,'frames':len(f),'activeWallSeconds':(f[-1][1]-f[0][1])/1000,'activeGameSeconds':f[-1][2]-f[0][2],'pathMetres':sum(math.hypot(b[3]-a[3],b[4]-a[4]) for a,b in zip(f,f[1:])),'actualMovingFrames':sum(math.hypot(b[3]-a[3],b[4]-a[4])>1e-5 for a,b in zip(f,f[1:])),'inputMovingFrames':sum(v[6] for v in f),'warmupExcludedSeconds':10,'steadyGpuMs':stats(gpu),'steadyDrawCpuMs':stats([v[8] for v in steady]),'steadyRenderSubmitCpuMs':stats([v[9] for v in steady]),'steadyRafIntervalMs':stats(intervals),'rafOver33_34ms':sum(v>33.34 for v in intervals),'gpu25msP95GatePassed':bool(gpu) and stats(gpu)['p95']<25,'maxDrawCalls':max(v[10] for v in f),'maxTriangles':max(v[11] for v in f),'nativeQueryLifecycle':p,'heapUsedBytes':stats([v['usedSize'] for v in heap]),'heapFirstLastBytes':[heap[0]['usedSize'],heap[-1]['usedSize']],'heapSamples':len(heap),'lateResourceCountRanges':{k:[min(v[k] for v in late),max(v[k] for v in late)] for k in ['geometries','textures','programs']},'phases':phases,'finalSaveSha256':sha(d/'final-save.json'),'profileSha256':sha(d/'browser-state.json'),'initialSaveSha256':r['initialSaveSha256'],'initialProfileSha256':r['initialProfileSha256'],'finalQuest':final['quest'],'finalKills':final['kills'],'finalHp':final['player']['hp'],'finalInventory':final['inventory'],'localReadyMs':r['localReadyMs'],'evidenceSha256':{p.name:sha(p) for p in [d/'raw.json',d/'samples.jsonl',d/'inputs.jsonl',d/'heap.json',d/'final-save.json',*[d/v['image'] for v in r['phases']]]}}
 # CDP backing storage is separate from its JS heap; neither is native GPU VRAM.
 summary['cdpBackingStorageBytes']=stats([v['backingStorageSize'] for v in heap])
 summary['cdpBackingFirstLastBytes']=[heap[0]['backingStorageSize'],heap[-1]['backingStorageSize']]
 summary['cdpEmbedderHeapBytes']=stats([v['embedderHeapUsedSize'] for v in heap])
 summary['browserReportedHeapUsedBytes']=stats([v['heap']['used'] for v in resources if v['heap']])
 if collect:
  for name in ['raw.json','inputs.jsonl','heap.json','final-save.json',*[v['image'] for v in r['phases']]]:shutil.copyfile(d/name,E/(mode+'-'+name))
  (E/(mode+'-samples.jsonl.gz')).write_bytes(gzip.compress((d/'samples.jsonl').read_bytes(),mtime=0))
 else:
  assert gzip.decompress((E/(mode+'-samples.jsonl.gz')).read_bytes())==(d/'samples.jsonl').read_bytes()
  for name,digest in summary['evidenceSha256'].items():
   if name!='samples.jsonl':assert sha(E/(mode+'-'+name))==digest
 return summary
def main(collect):
 if collect:E.mkdir(exist_ok=True)
 tests=ROOT/'dist/runtime-budget-probe-tests-2026-11-05.txt'
 assert '# pass 3' in tests.read_text() and '# fail 0' in tests.read_text()
 if collect:shutil.copyfile(tests,E/'probe-tests.txt')
 else:assert sha(E/'probe-tests.txt')==sha(tests)
 manifest=load(ROOT/'dist'/(PACKAGE+'.json'));assert sha(ROOT/'dist'/(PACKAGE+'.zip'))==DIGEST
 with zipfile.ZipFile(ROOT/'dist'/(PACKAGE+'.zip')) as z:
  assert len(manifest['files'])==211 and len(z.namelist())==212 and z.testzip() is None
  for name,v in manifest['files'].items():
   assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name))==v['sha256']
   assert sha(ROOT/'dist'/PACKAGE/'tidelands-local'/name)==v['sha256']
   assert hashlib.sha256(z.read('tidelands-local/'+name)).hexdigest()==v['sha256']
 result={'package':PACKAGE,'packageSha256':DIGEST,'runtimeInputs':211,'probeTests':3,'testReceiptSha256':sha(tests),'runs':[audit(mode,collect) for mode in ['desktop','narrow']],'sourceSha256':{p:sha(ROOT/p) for p in ['tools/runtime_budget_probe.js','tools/run_runtime_budget.mjs','tools/verify_runtime_budget.py','tests/runtime-budget-probe.test.js']},'systemGpuIsolated':False,'vramMeasured':False,'forcedGc':False,'physicalMobileAccepted':False,'longEnduranceAccepted':False,'wholeGoalComplete':False,'m5Complete':False,'performanceGainClaimed':False}
 if collect:(E/'audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 else:assert load(E/'audit.json')==result
 print(json.dumps({'verified':True,'runs':[{k:r[k] for k in ['mode','frames','activeWallSeconds','pathMetres','steadyGpuMs','steadyRafIntervalMs','gpu25msP95GatePassed','heapFirstLastBytes','lateResourceCountRanges']} for r in result['runs']],'m5Complete':False}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--collect',action='store_true');main(p.parse_args().collect)
