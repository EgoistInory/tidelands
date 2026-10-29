"""Validate actual-main diagnostic masks without claiming a production optimization."""
from pathlib import Path
import hashlib,json,math,zipfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def summary(values):
    a=sorted(values);return {'samples':len(a),'median':a[len(a)//2],'p95':a[int(len(a)*.95)],'max':a[-1]}
def verify():
    package=read('dist/tidelands-m5-2026-10-29-ground-support.json');assert len(package['files'])==209
    assert sha('dist/'+package['archive'])==package['archiveSha256']=='ee606c25629a7b9f704fc504d661abea31264244b52027a9530253c60ca8301f'
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as z:
        for p,v in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)==v['sha256'],p
            assert hashlib.sha256(z.read('tidelands-local/'+p)).hexdigest()==v['sha256']
            assert sha('dist/tidelands-m5-2026-10-29-ground-support/tidelands-local/'+p)==v['sha256']
    reports={};modes=['baseline','reuseShadow','noGround','noWater','noSky','noDressing','noTrees']
    for kind,file in [('stationary','docs/main-gpu-attribution-native.json'),('orbit','docs/main-gpu-attribution-orbit.json')]:
        r=read(file);assert r['complete'] and r['supported'] and not r['error'] and not r['hidden'] and r['disjoint']==0
        assert bool(r.get('orbit',False))==(kind=='orbit')
        assert len(r['frames'])>600 and len(r['gpuRaw'])==math.ceil(len(r['frames'])/2)
        assert r['frames'][-1]['at']-r['frames'][0]['at']>15000
        for s in [r['before'],r['after']]:
            assert s['worldUnchanged'] and s['authoredCast'] and s['coastal'] and s['inland'] and s['glError']==0 and not s['runtimeOutsideBase']
            assert s['runtimeBase'].endswith('/tidelands-m5-2026-10-29-ground-support/tidelands-local/')
            assert s['viewport']==[1280,720] and s['buffer']==[1920,1080]
        for k in ['x','z','hp','yaw']:assert r['before']['player'][k]==r['after']['player'][k],k
        # The actual main tick can replenish the startup stamina deficit while standing still.
        assert 0<=r['before']['player']['stamina']<=r['after']['player']['stamina']<=100
        assert r['before']['inventory']==r['after']['inventory']
        frames={f['at']:f for f in r['frames']};bins={mode:{} for mode in modes}
        for q in r['gpuRaw']:
            assert q['mode'] in modes and math.isfinite(q['ms']) and q['ms']>0
            f=frames[q['at']];assert f['mode']==q['mode'];p=r['before']['player'];angle=math.atan2(f['camera'][0]-p['x'],f['camera'][2]-p['z'])%(2*math.pi);sector=min(3,int(angle/(math.pi/2)));bins[q['mode']].setdefault(sector,[]).append(q['ms'])
        for mode in modes:
            values=[q['ms'] for q in r['gpuRaw'] if q['mode']==mode];assert len(values)>=40
            actual=summary(values)
            for k,v in actual.items():assert r['groups'][mode]['gpuMs'][k]==v,(kind,mode,k)
        reports[kind]={'frames':len(r['frames']),'queries':len(r['gpuRaw']),'groups':r['groups'],'angularGpu':{m:{b:summary(v) for b,v in d.items()} for m,d in bins.items()}}
    assert read('docs/main-gpu-attribution-console.json')==[] and read('docs/main-gpu-attribution-orbit-console.json')==[]
    for p in ['docs/main-gpu-attribution-restored.png','docs/main-gpu-attribution-restored-live.png','docs/main-gpu-attribution-orbit-restored.png']:
        with Image.open(ROOT/p) as im:im.load();assert im.size==(1280,720)
    assert '# pass 382' in (ROOT/'docs/main-gpu-attribution-tests.txt').read_text()
    assert '# fail 1' in (ROOT/'docs/main-gpu-attribution-red.txt').read_text()
    assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    report={'verified':True,'productionChanged':False,'productionInputsPreserved':209,'fullGoalComplete':False,'milestoneM5Complete':False,'finalPerformanceAccepted':False,'tests':382,'reports':reports,'sourceHashes':{p:sha(p) for p in ['tests/main-gpu-attribution.js','tests/main-gpu-attribution.html','tests/main-gpu-attribution.test.js']},'scope':'Actual packaged main, stationary declared fixture and automated requested orbit, interleaved diagnostic removal and shadow-map reuse. Quality is intentionally incomplete during masks. Differences are not additive. No real input orbit, normal campaign/combat/audio/device/endurance/VRAM or production optimization proof.'}
    (ROOT/'docs/main-gpu-attribution-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='reports'},ensure_ascii=False))
if __name__=='__main__':verify()
