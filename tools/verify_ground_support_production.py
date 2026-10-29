"""Audit this finite production increment; never marks full M5 quality complete."""
from pathlib import Path
import hashlib,json,math,zipfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-29-ground-support'
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    package=read('dist/'+NAME+'.json');old=read('dist/tidelands-m5-2026-10-29-berry-runtime.json')
    assert len(package['files'])==209 and package['archiveEntries']==210
    assert package['archiveSha256']=='ee606c25629a7b9f704fc504d661abea31264244b52027a9530253c60ca8301f'
    assert sha('dist/'+NAME+'.zip')==package['archiveSha256']
    changed={p for p,v in package['files'].items() if old['files'].get(p)!=v}
    assert changed=={'README.md','src/ground-support.js','src/meadow.js','src/scene.js'},changed
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as z:
        assert len(z.infolist())==210
        for p,v in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)==v['sha256'],p
            assert hashlib.sha256(z.read('tidelands-local/'+p)).hexdigest()==v['sha256'],p
            assert sha('dist/'+NAME+'/tidelands-local/'+p)==v['sha256'],p
    assert sha('dist/'+old['archive'])==old['archiveSha256']=='edb40edf0b8ae3cb6994732998839062da1de6d6e2a0f299c91476086bbbac57'
    for p,v in old['files'].items():assert sha('dist/tidelands-m5-2026-10-29-berry-runtime/tidelands-local/'+p)==v['sha256']
    assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    numerical=read('docs/ground-support-numerical.json')
    assert numerical['verified'] and numerical['productionIntegrated'] and numerical['worldUnchanged'] and numerical['exactCampRestore']
    assert numerical['nonYValuesIdentical']==1584540 and numerical['containedInstances']==105636 and numerical['campHiddenInstances']==20
    for p,h in numerical['sourceHashes'].items():assert sha(p)==h,p
    audit=numerical['audit'];assert audit['instances']==105636 and audit['rootQueries']==1063824 and audit['bufferBytes']==6760704
    assert -.03501<audit['maxRootGap']<-.03499 and -.547<audit['minRootGap']<-.545
    rows={r['label']:r for r in read('docs/ground-support-observations.json')};assert len(rows)==23
    for r in rows.values():
        assert r['worldUnchanged'] and r['glError']==0 and not r['runtimeOutsideBase']
        assert r['authoredCast'] and r['inlandInstalled'] and r['coastalInstalled']
        assert r['groundSupport']['instances']==105636 and r['groundSupport']['bufferBytes']==6760704
        if r['baseline']:
            assert not r['hasProductionSampler'] and r['groundSupport']['maxRootGap']>.34
        else:
            assert r['hasProductionSampler'] and r['groundSupport']['maxRootGap']==audit['maxRootGap']
        if r['delivery']:assert r['runtimeBase'].endswith('/'+NAME+'/tidelands-local/')
    fields=['player','inventory','buildings','depleted','quest','kills','time','respawn','discovered','selected']
    for x,y in [('source-manual-saved','source-reload'),('delivery-saved','delivery-reload'),('ordinary-saved','ordinary-reload-narrow')]:
        a,b=[json.loads(rows[k]['serializedState']) for k in [x,y]]
        for k in fields:assert a[k]==b[k],(x,y,k)
        assert len(a['enemies'])==len(b['enemies'])==79
        for e,f in zip(a['enemies'],b['enemies']):
            for k in ['id','type','x','z','hp','homeX','homeZ']:assert e[k]==f[k],(x,y,k)
    for prefix in ['source','delivery']:
        before,built,reload=[rows[prefix+s] for s in ['-before','-built','-reload']]
        assert before['hiddenDecoration']==0 and before['inventory']['wood']==before['inventory']['stone']==30
        assert built['hiddenDecoration']==reload['hiddenDecoration']==5 and len(built['buildings'])==1
        assert built['inventory']['wood']==25 and built['inventory']['stone']==27
        assert built['windTime']>before['windTime'] and built['windCompiledPrograms']==['color'] and built['shadowsEnabled']
    # The first Node-only preview lacked authored wood occupancy; preserve the native rejection.
    assert rows['source-preview']['placement']['error']=='这里被树木或岩石占据。'
    assert rows['source-preview-after-heading']['placement']['error']==''
    ordinary=json.loads(rows['ordinary-before']['serializedState']);backup=read('docs/beacon-footing-normal-save.json')
    for k in fields:assert ordinary[k]==backup[k],k
    distances={}
    for label,x,y in [('ordinary','ordinary-before','ordinary-moved'),('embeddedPointer','embedded-before','embedded-pointer-moved')]:
        a,b=rows[x]['player'],rows[y]['player'];distances[label]=math.hypot(a['x']-b['x'],a['z']-b['z']);assert distances[label]>1
    assert rows['ordinary-reload-narrow']['viewport']==[390,844] and rows['ordinary-reload-narrow']['buffer']==[585,1266]
    consoles=list(ROOT.glob('docs/ground-support-*-console.json'));assert len(consoles)==6
    for p in consoles:assert json.loads(p.read_text())==[],p.name
    photos={r['screenshot'] for r in rows.values() if 'screenshot' in r};assert len(photos)==8
    for p in photos:
        with Image.open(ROOT/p) as im:im.load();assert im.size==(1280,720)
    assert '# pass 379' in (ROOT/'docs/ground-support-production-tests.txt').read_text()
    assert '# fail 2' in (ROOT/'docs/ground-support-production-red.txt').read_text()
    assert 'boundingSphere' in (ROOT/'docs/ground-support-audit-box-error.txt').read_text()
    timings={k:rows[k]['timing'] for k in ['source-before','delivery-before','baseline-startup']}
    report={'verified':True,'productionIntegrated':True,'functionalAccepted':True,'fullGoalComplete':False,'milestoneM5Complete':False,'finalVisualQualityAccepted':False,'currentGpuMeasured':False,'currentEnduranceMeasured':False,'package':{k:package[k] for k in ['archive','archiveBytes','archiveSha256','archiveEntries']},'runtimeInputs':209,'changedInputs':sorted(changed),'nativeRows':len(rows),'nativeImages':len(photos),'distances':distances,'startupObservations':timings,'nominalRootRange':[audit['minRootGap'],audit['maxRootGap']],'scope':'Finite decorative support production delivery. Single cached startup observations, not a controlled benchmark. Color wind uniform progresses and existing shadow receiving remains; grass does not gain cast shadows. No full journey, new GPU/endurance/audio/device or final-quality proof.'}
    (ROOT/'docs/ground-support-production-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':verify()
