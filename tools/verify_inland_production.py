"""Verify exact production inputs, extracted delivery and scoped native evidence."""
from pathlib import Path
import hashlib,json,math,zipfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-29-inland-runtime'
def read(path):return json.loads((ROOT/path).read_text())
def sha(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
def verify():
    package=read('dist/'+NAME+'.json');assert len(package['files'])==207 and package['archiveEntries']==208
    assert sha('dist/'+NAME+'.zip')==package['archiveSha256'];extracted=ROOT/'dist'/NAME/'tidelands-local'
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as archive:
        assert len(archive.infolist())==208
        for name,row in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)==row['sha256'],name
            assert hashlib.sha256(archive.read('tidelands-local/'+name)).hexdigest()==row['sha256']
            assert hashlib.sha256((extracted/name).read_bytes()).hexdigest()==row['sha256']
    provenance=read('assets/inland/provenance.json');assert provenance['license']=='CC0-1.0' and len(provenance['files'])==24
    for name,row in provenance['files'].items():assert sha('assets/inland/'+name)==row['sha256']
    core=read('docs/inland-production-core-audit.json');assert core['verified'] and core['productionCoreInputs'] and len(core['rows'])==15 and core['regrowthBuildRejections']==14
    assert core['runtimeFootprintSha256']==package['files']['src/resource-footprint.js']['sha256']
    expected_ids=[p['id'] for p in read('assets/inland/inland-contact-shapes.json')['placements']]
    observations=read('docs/inland-production-main-observations.json');rows={r['label']:r for r in observations}
    for r in observations:
        assert r['productionInlandInstalled'] and r['treeCount']==15 and r['ids']==expected_ids and r['contactBoxes']==3114 and r['visible3D']<=1 and r['worldUnchanged'] and r['glError']==0
    durable=['player','inventory','buildings','depleted','quest','kills','time','respawn','discovered','selected']
    def same_save(a,b):
        a,b=json.loads(a['serializedState']),json.loads(b['serializedState'])
        for key in durable:assert a[key]==b[key],key
        assert len(a['enemies'])==len(b['enemies'])
        for x,y in zip(a['enemies'],b['enemies']):
            for key in ['id','type','x','z','hp','homeX','homeZ']:assert x[key]==y[key],key
    for prefix in ['source','delivery']:
        before,blocked,repeat,gather,passed=[rows[prefix+'-'+name] for name in ['before','blocked','blocked-repeat','gather','passage']]
        assert before['visible3D']==1 and before['targetVisible'] and before['resourceLODs']==['near']
        assert blocked['player']==repeat['player'] and .8<math.dist([before['player'][k] for k in ['x','z']],[blocked['player'][k] for k in ['x','z']])<3
        assert gather['inventory']['wood']==33 and gather['targetDepleted'] and not gather['targetVisible']
        assert math.dist([blocked['player'][k] for k in ['x','z']],[passed['player'][k] for k in ['x','z']])>3.5
        same_save(rows[prefix+'-saved'],rows[prefix+'-reloaded'])
    isolated=rows['delivery-isolated-resources'];assert isolated['runtimeResourceCount']>100 and isolated['runtimeOutsideBase']==[] and '/dist/'+NAME+'/' in isolated['runtimeBase']
    before,rest=[rows['source-embedded-mid-legacy-'+k] for k in ['before','rest']];assert before['viewport']==[390,844] and before['buffer']==[585,1266] and before['resourceLODs']==['mid']
    assert before['player']['hp']==62 and rest['player']['hp']==100 and before['buildings']==rest['buildings'] and rest['near']['type']=='campfire' and not rest['targetVisible']
    before,blocked,repeat,gather,passed=[rows['delivery-embedded-mid-'+name] for name in ['before','stick-blocked','stick-blocked-repeat','pointer-gather','stick-passage']]
    assert before['viewport']==[390,844] and before['buffer']==[585,1266] and before['resourceLODs']==['mid'] and before['visible3D']==1
    assert .8<math.dist([before['player'][k] for k in ['x','z']],[blocked['player'][k] for k in ['x','z']])<3 and repeat['player']==blocked['player']
    assert gather['inventory']['wood']==33 and gather['targetDepleted'] and not gather['targetVisible'] and passed['runtimeOutsideBase']==[]
    assert math.dist([blocked['player'][k] for k in ['x','z']],[passed['player'][k] for k in ['x','z']])>3.5
    ordinary=rows['source-ordinary-copy-before'];saved=json.loads(ordinary['serializedState']);backup=read('docs/beacon-footing-normal-save.json')
    for key in durable:assert saved[key]==backup[key],key
    same_save(rows['source-ordinary-copy-saved'],rows['source-ordinary-copy-reloaded']);assert rows['source-ordinary-copy-moved']['player']!=ordinary['player']
    ordinary=rows['delivery-ordinary-copy-before'];saved=json.loads(ordinary['serializedState'])
    for key in durable:assert saved[key]==backup[key],key
    same_save(rows['delivery-ordinary-copy-saved'],rows['delivery-ordinary-copy-reloaded']);assert rows['delivery-ordinary-copy-moved']['player']!=ordinary['player']
    before,built=rows['delivery-build-before'],rows['delivery-built-camp'];assert len(before['buildings'])==0 and len(built['buildings'])==1 and built['buildings'][0]['type']=='campfire'
    assert built['inventory']['wood']==before['inventory']['wood']-5 and built['inventory']['stone']==before['inventory']['stone']-3
    same_save(rows['delivery-built-camp-saved'],rows['delivery-built-camp-reloaded'])
    red,green=read('docs/inland-production-fallback-red.json'),read('docs/inland-production-fallback-green.json');assert red['syncFailureInjected'] and red['productionInlandInstalled'] and red['directContactBoxes']==3114
    assert green['syncFailureInjected'] and not green['productionInlandInstalled'] and green['directContactBoxes']==0 and green['worldUnchanged']
    lifecycle=read('docs/inland-production-lifecycle.json');assert lifecycle['complete']
    assert [(r['mode'],r['ownedResources']) for r in lifecycle['rows']]==[('release-twice',28),('abort-after-model',15),('fail-after-far-textures',19)]
    for row in lifecycle['rows']:assert row['verified'] and all(n==1 for n in row['disposeCounts'])
    runtime=read('docs/inland-production-runtime-audit.json');assert runtime['verified'] and runtime['productionIntegrated'] and runtime['productionRuntimeFilesVerified']==207 and runtime['deliverySha256']==package['archiveSha256']
    for file,digest in runtime['sourceHashes'].items():assert sha(file)==digest
    images={}
    for name in ['source-before','source-after','delivery-before','delivery-after','embedded-legacy','embedded-before','embedded-after','built-camp','runtime-desktop','runtime-embedded']:
        path='docs/inland-production-'+name+'.png'
        with Image.open(ROOT/path) as image:assert image.size==(1280,720)
        images[path]=sha(path)
    for name in ['source','ordinary','delivery','delivery-ordinary','built','embedded','embedded-pointer','fallback','runtime-desktop','runtime-embedded']:assert read('docs/inland-production-'+name+'-console.json')==[]
    # This browser log survives reload and retains the first, independently saved QA assertion.
    first=read('docs/inland-production-lifecycle-first-failure.json');logs=read('docs/inland-production-lifecycle-console.json')
    assert not first['complete'] and first['error']=='Preparation lifecycle mismatch' and first['rows'][-1]['ownedResources']==15
    assert len(logs)==1 and logs[0]['message'].startswith('Error: Preparation lifecycle mismatch\n') and logs[0]['url'].endswith('/tests/inland-production-lifecycle.html')
    testlog=(ROOT/'docs/inland-production-tests.txt').read_text();assert '# tests 370' in testlog and '# pass 370' in testlog and '# fail 0' in testlog
    assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    assert sha('dist/tidelands-m5-2026-10-27-coastal-contact-budget.zip')=='339b94dedad2a2749ac390a06a4c6d8e97213b07623c5e969d8a0d1a3b994913'
    report=dict(verified=True,productionIntegrated=True,productionAssets=25,originalResourceIdsPreserved=15,currentCoreAll15Verified=True,nativeSourceAndExtractedPackageGatherPassSave=True,ordinaryBackupCopyPreserved=True,originalOrdinaryKeyTouched=False,normalAbortPartialFailureResourceCounts=[28,15,19],bindSyncFailureRollbackRedToGreen=True,testsPassed=370,archive='dist/'+NAME+'.zip',archiveBytes=package['archiveBytes'],archiveSha256=package['archiveSha256'],runtimeFiles=207,archiveEntries=208,actualEmbeddedViewport=[390,844],actualEmbeddedBuffer=[585,1266],nativeOuterNarrowBrowserAccepted=False,images=images,finalPerformanceAccepted=False,longRunOrPhysicalDeviceAccepted=False,milestoneM5Complete=False,fullGoalComplete=False,scope='Actual production startup and extracted package, declared resource/camp fixtures plus exact ordinary backup copy. Embedded narrow viewport is separate from outer browser size; performance photos are post-interval live views. Not new full journey, physical phone, long-run, audio/VRAM or full3A acceptance.')
    report.update(embeddedNarrowPointerJoystickGatherAndPass=True,physicalTouchDeviceAccepted=False,nativeCampBuiltAndReloaded=True,nativeExtractedOrdinaryBackupCopyVerified=True,gameConsoleFilesClean=10,historicalQaAssertionErrorsPreserved=1)
    (ROOT/'docs/inland-production-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False))
if __name__=='__main__':verify()
