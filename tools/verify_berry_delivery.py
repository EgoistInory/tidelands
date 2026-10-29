"""Verify the finite berry increment, immutable package and scoped native evidence."""
from pathlib import Path
import hashlib,json,math,subprocess,zipfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-29-berry-runtime'
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    package=read('dist/'+NAME+'.json');old=read('dist/tidelands-m5-2026-10-29-inland-runtime.json')
    assert len(package['files'])==208 and package['archiveEntries']==209
    assert sha('dist/'+NAME+'.zip')==package['archiveSha256']
    changed={p for p,r in package['files'].items() if old['files'].get(p)!=r}
    assert changed=={'README.md','src/berry.js','src/scene.js'},changed
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as z:
        assert len(z.infolist())==209
        for p,r in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)==r['sha256'],p
            assert hashlib.sha256(z.read('tidelands-local/'+p)).hexdigest()==r['sha256']
            assert sha('dist/'+NAME+'/tidelands-local/'+p)==r['sha256']
    assert sha('dist/tidelands-m5-2026-10-29-inland-runtime.zip')=='2e561ab01a872e3453cb9553b8ccf8b9a4067e4aea135f3851ce0200f0f11781'
    for p,r in old['files'].items():assert sha('dist/tidelands-m5-2026-10-29-inland-runtime/tidelands-local/'+p)==r['sha256']
    assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    numerical=read('docs/berry-resource-numerical.json');assert numerical['verified'] and numerical['triangles']==6545 and numerical['attachments']==21 and len(numerical['originalNodes'])==61
    for p,h in numerical['sourceHashes'].items():assert sha(p)==h
    frozen='// Frozen scene baseline1764ad5; only sibling import URLs rebased for review. Not packaged.\n'+subprocess.check_output(['git','show','1764ad5:src/scene.js'],cwd=ROOT,text=True).replace("from './","from '../src/")
    assert (ROOT/'tests/resource-detail-baseline-scene.js').read_text()==frozen
    assert read('docs/resource-detail-observations.json')==[], 'Preserve failed recorder output'
    visual=read('docs/resource-detail-verified-observations.json');assert len(visual)==10
    for r in visual:assert r['worldUnchanged'] and r['authoredCast'] and r['inland'] and r['coastal'] and r['glError']==0
    pairs={}
    for r in visual:pairs.setdefault((r['type'],r['distance'],r['light']),{})[r['variant']]=r
    assert len(pairs)==5
    for pair in pairs.values():
        a,b=pair['old'],pair['candidate'];assert a['camera']==b['camera'] and a['node']==b['node'] and a['buffer']==b['buffer'];assert a['render']['calls']==b['render']['calls']
    first=read('docs/resource-detail-first-observations.json');assert len(first)==7
    # The first follow views retain different camera poses and are not accepted comparisons.
    rejected=[r for r in first if r['distance']=='follow'];assert len(rejected)==3
    assert rejected[0]['camera']!=rejected[1]['camera']
    rows={r['label']:r for r in read('docs/berry-production-observations.json')}
    for r in rows.values():
        assert r['worldUnchanged'] and r['glError']==0 and r['berryNodes']==61 and r['berryParts']==3 and not r['leafCutout']
        assert r['authoredCast'] and r['inlandInstalled'] and r['coastalInstalled'] and not r['runtimeOutsideBase']
    for prefix in ['source','delivery','embedded']:
        before,gather=rows[prefix+'-before'],rows[prefix+'-gather']
        assert before['inventory']['berry']==3 and before['visibleParts']==3 and not before['depleted']
        assert gather['inventory']['berry']==5 and gather['visibleParts']==0 and gather['depleted']
        assert gather['depletedUntil']>gather['time']
    regrowth=rows['source-regrowth'];assert regrowth['time']>rows['source-gather']['depletedUntil'] and regrowth['visibleParts']==3 and not regrowth['depleted'] and regrowth['inventory']['berry']==5
    assert rows['source-second-gather']['inventory']['berry']==7 and rows['source-second-gather']['visibleParts']==0
    durable=['player','inventory','buildings','depleted','quest','kills','time','respawn','discovered','selected']
    def same_save(a,b):
        a,b=json.loads(a['serializedState']),json.loads(b['serializedState'])
        for k in durable:assert a[k]==b[k],k
        assert len(a['enemies'])==len(b['enemies'])==79
        for x,y in zip(a['enemies'],b['enemies']):
            for k in ['id','type','x','z','hp','homeX','homeZ']:assert x[k]==y[k],k
    for prefix in ['source','delivery','ordinary']:same_save(rows[prefix+'-saved'],rows[prefix+'-reload'])
    ordinary=json.loads(rows['ordinary-before']['serializedState']);backup=read('docs/beacon-footing-normal-save.json')
    for k in durable:assert ordinary[k]==backup[k]
    start,after=rows['ordinary-before']['player'],rows['ordinary-moved']['player'];assert math.hypot(start['x']-after['x'],start['z']-after['z'])>1
    embedded=rows['embedded-before'];assert embedded['viewport']==[390,844] and embedded['buffer']==[585,1266]
    start,after=rows['embedded-gather']['player'],rows['embedded-moved']['player'];assert math.hypot(start['x']-after['x'],start['z']-after['z'])>1
    perf={}
    for mode in ['desktop','embedded']:
        r=read('docs/berry-runtime-'+mode+'.json');assert r['complete'] and r['supported'] and not r['hidden'] and r['disjointCount']==0 and not r['error']
        assert r['worldUnchanged'] and len(r['gpuRawMs'])>=60 and len(r['frames'])>600
        assert len(r['gpuRawMs'])==math.ceil(len(r['frames'])/8)
        assert all(math.isfinite(t) and t>0 for t in r['gpuRawMs'])
        assert r['rafIntervalMs']['p95']<33.34
        for k in ['stateBefore','stateAfter']:assert r[k]['glError']==0 and not r[k]['runtimeOutsideBase']
        assert r['stateBefore']['runtimeBase'].endswith('/'+NAME+'/tidelands-local/')
        assert r['stateBefore']['viewport']==([1280,720] if mode=='desktop' else [390,844])
        perf[mode]={k:r[k] for k in ['gpuMs','drawCpuMs','rafIntervalMs','elapsedMs']}
    baseline=read('docs/berry-runtime-baseline-desktop.json');current=read('docs/berry-runtime-desktop.json')
    assert baseline['complete'] and not baseline['hidden'] and baseline['disjointCount']==0 and not baseline['error']
    assert baseline['stateBefore']['runtimeBase'].endswith('/tidelands-m5-2026-10-29-inland-runtime/tidelands-local/')
    for k in ['player','inventory','viewport','buffer']:assert baseline['stateBefore'][k]==current['stateBefore'][k]
    # Explicit relative guard; the original25ms GPU gate is recorded separately, never relabelled a pass.
    assert current['gpuMs']['p95']<=baseline['gpuMs']['p95']*1.2
    assert current['rafIntervalMs']['p95']<=baseline['rafIntervalMs']['p95']*1.2
    desktop_gpu_gate=current['gpuMs']['p95']<25
    perf['baselineDesktop']={k:baseline[k] for k in ['gpuMs','drawCpuMs','rafIntervalMs','elapsedMs']}
    for p in ['docs/resource-detail-console.json','docs/berry-source-console.json','docs/berry-delivery-console.json','docs/berry-embedded-console.json','docs/berry-ordinary-console.json','docs/berry-runtime-desktop-console.json','docs/berry-runtime-embedded-console.json','docs/berry-runtime-baseline-desktop-console.json']:assert read(p)==[],p
    failures=read('docs/berry-production-startup-failure-console.json');assert len(failures)==1 and 'Unexpected token' in failures[0]['message']
    images={}
    for p in sorted([*ROOT.glob('docs/resource-detail-*.png'),*ROOT.glob('docs/berry-production-*.png')]):
        with Image.open(p) as im:assert im.size==(1280,720);im.verify()
        images[str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
    assert len(images)>=23
    tests=(ROOT/'docs/berry-production-tests.txt').read_text();assert '# tests 375' in tests and '# pass 375' in tests and '# fail 0' in tests
    report={'verified':True,'berryProductionIntegrated':True,'crystalCandidatePromoted':False,'productionBerryNodes':61,'resourceInstancedParts':3,'nativeNaturalRegrowthAndSecondGather':True,'naturalRegrowthGameTime':regrowth['time']-rows['source-gather']['time'],'nativePackageGatherSaveReload':True,'nativeOrdinaryBackupCopyRestored':True,'originalOrdinaryKeyTouched':False,'testsPassed':375,'runtimeFiles':208,'archiveEntries':209,'archiveBytes':package['archiveBytes'],'archiveSha256':package['archiveSha256'],'archive':'dist/'+NAME+'.zip','runtimeDelta':sorted(changed),'visualComparisonPairs':5,'firstUnsettledFollowViewsRejected':3,'crystalSteepTerrainSupportAccepted':False,'embeddedViewport':[390,844],'embeddedBuffer':[585,1266],'outerNarrowBrowserAccepted':False,'physicalTouchDeviceAccepted':False,'performance':perf,'desktopGpu25msGatePassed':desktop_gpu_gate,'embeddedGpu25msGatePassed':perf['embedded']['gpuMs']['p95']<25,'failedRecorderOutputPreserved':True,'desktopRelativeGuardPassed':True,'performanceGainAccepted':False,'gpuSystemLoadIsolated':False,'images':images,'historicalQaSyntaxErrorPreserved':True,'fullVisualQualityAccepted':False,'finalPerformanceAccepted':False,'currentFullJourneyReplayed':False,'longRunOrPhysicalDeviceAccepted':False,'milestoneM5Complete':False,'fullGoalComplete':False,'scope':'Finite berry geometry/attachment increment with native main and independent package proof. Crystal candidate rejected for limited normal-distance gain. Bare highland/steep resource support, static berry wind, final motion/audio/endurance/device/whole3A remain open.'}
    (ROOT/'docs/berry-production-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['images','performance']},ensure_ascii=False))
if __name__=='__main__':verify()
