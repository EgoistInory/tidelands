"""Audit the finite motion/confirmed-impact delivery against actual frozen evidence."""
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-23-motion-impact-r2'
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
load=lambda p:json.loads((ROOT/p).read_text())


def verify():
    report=load('dist/'+NAME+'.json');old=load('dist/tidelands-m5-2026-10-23-rhythm-center.json')
    assert report['archiveSha256']=='5efddbb97fb0986f2d30e922108edce5f7384c82d9def94a9385e7ad69feaa7e'
    assert sha('dist/'+NAME+'.zip')==report['archiveSha256'] and len(report['files'])==93 and report['archiveEntries']==94
    assert not report['fullGoalComplete']
    baseline=load('dist/tidelands-m5-2026-10-23-motion-impact.json')
    assert sha('dist/tidelands-m5-2026-10-23-motion-impact.zip')=='b599cf044a24de8d1a509dc88eb97ea676e3ea52c1dc340707151436d173e2a4'
    assert set(baseline['files'])==set(report['files'])
    assert {p for p,e in report['files'].items() if baseline['files'][p]['sha256']!=e['sha256']}=={'src/impact-feedback.js'}
    changed={p for p,e in report['files'].items() if old['files'].get(p,{}).get('sha256')!=e['sha256']}
    assert changed=={'src/authored-character.js','assets/characters/action-landmarks.json','src/impact-feedback.js','src/main.js','src/scene.js'}
    unpacked=load('docs/'+NAME+'-verification.json');extracted=Path(unpacked['extractedPath'])
    assert unpacked['passed'] and unpacked['checkedFiles']==93 and unpacked['archiveSha256']==report['archiveSha256']
    with zipfile.ZipFile(ROOT/'dist'/report['archive']) as archive:
        for path,entry in report['files'].items():
            local='docs/LOCAL-DELIVERY.md' if path=='README.md' else path
            assert sha(local)==entry['sha256'],path
            assert hashlib.sha256(archive.read('tidelands-local/'+path)).hexdigest()==entry['sha256'],path
            assert hashlib.sha256((extracted/path).read_bytes()).hexdigest()==entry['sha256'],path
    for component in ['authored-motion','impact-feedback']:
        evidence=load('docs/'+component+'-audit.json');assert evidence['verified'] and not evidence['fullGoalComplete']
        for path,digest in evidence['files'].items():assert sha(path)==digest,path
    package=load('docs/motion-impact-package-browser.json')
    assert not package['console'] and package['origin']=='http://127.0.0.1:59851'
    assert '位置 X 7.8，Z 57.4；建筑 1；击败 3' in package['beforeAx']
    for field in ['afterMoveAx','mobileRestoreAx']:
        assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in package[field]
        assert 'progress indicator Value: 79, ID: hp' in package[field] and '群岛，再次相连' in package[field]
    assert '存档已保存。' in package['savedAx']
    cleanup_restore=load('docs/motion-impact-r2-browser.json')
    assert not cleanup_restore['console'] and '位置 X 7.2，Z 53.5；建筑 1；击败 3' in cleanup_restore['ax']
    assert 'progress indicator Value: 79, ID: hp' in cleanup_restore['ax'] and '群岛，再次相连' in cleanup_restore['ax']
    for name,count in [('木材',4),('石料',5),('纤维',6),('浆果',3),('石斧',1),('晶石剑',0)]:
        assert re.search(r'text '+name+r'\n\s+\d+ text '+str(count)+r'\n',package['bagAx']),name
    gpu=load('docs/motion-impact-gpu.json');assert [r['label'] for r in gpu]==['desktop','mobile']
    for sample,size in zip(gpu,[[1920,1080],[390,844]]):
        assert sample['complete'] and sample['authored'] and sample['viewport']==sample['buffer']==size
        assert sample['peak']==48 and not sample['hidden'] and not sample['disjoint'] and sample['glError']==0
        assert [r['stage'] for r in sample['rows']]==['shore','forest','highland','shoal','night-camp']
        for row in sample['rows']:
            assert row['poolActive']==48 and len(row['gpuRawMs'])==60 and all(n>0 for n in row['gpuRawMs'])
            assert row['gpuMs']['samples']==60 and row['gpuMs']['p95']<20
        release=sample['release'];assert release['active']==0 and release['before']['geometries']-release['after']['geometries']==1
        assert release['before']['textures']==release['after']['textures']
    run=load('docs/motion-impact-endurance.json')
    assert run['complete'] and run['targetMs']==600000 and run['activeMs']>=600000 and run['frames']>30000
    assert run['authored'] and all(r[1] for r in run['roles']) and not run['hidden']
    assert run['movingFraction']>=.8 and run['distanceMeters']>2500 and run['hitCount']>20 and run['damageTaken']>0 and run['respawns']==0
    assert run['impactBursts']==run['hitCount'] and 6<=run['impactPeak']<=48
    assert run['stepAttempts']==run['stepsScheduled'] and run['stepsScheduled']>500
    assert run['spatialAttempts']==run['spatialScheduled'] and run['pannersCreated']==run['pannersReleased'] and run['pannersPeak']<=12
    assert run['settled']['voices']==0 and run['settled']['pannersCreated']==run['settled']['pannersReleased']
    assert len(run['stages'])==5 and len(run['checkpoints'])==11 and all(c['glError']==0 for c in run['checkpoints'])
    assert run['p95Ms']<25 and not load('docs/motion-impact-endurance-console.json')
    tests=(ROOT/'docs/motion-impact-package-tests.txt').read_text();assert 'Ran 5 tests' in tests and '\nOK\n' in tests
    assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    assert sha('dist/tidelands-m5-2026-10-23-rhythm-center.zip')=='8bc83a22213e541bf876e164ed622f44f34fcd6ab1976eaad4c388562d24eabc'
    images=['docs/motion-impact-'+name+'.jpg' for name in ['gpu-desktop','gpu-mobile','package-desktop','package-mobile','r2-restored','endurance-start','endurance-forest','endurance-highland','endurance-shoal','endurance-night','endurance-complete']]
    for path in images:assert (ROOT/path).read_bytes()[:2]==b'\xff\xd8',path
    files=images+['tests/impact-budget-review.html','tests/motion-impact-endurance.html','docs/motion-impact-gpu.json','docs/motion-impact-gpu-initial.json','docs/motion-impact-package-browser.json','docs/motion-impact-r2-browser.json','docs/motion-impact-package-tests.txt','docs/motion-impact-endurance.json','docs/motion-impact-endurance-start.json','docs/motion-impact-endurance-console.json','docs/authored-motion-audit.json','docs/impact-feedback-audit.json','docs/'+NAME+'-verification.json']
    result={'verified':True,'boundedGroupsDelivered':True,'runtimeCommit':'e3b9c7cb62976839e6688ff5245bff0106250df9','continuousRunRuntimeCommit':'aa9aec2668e8effdd85c25e1282518809bb485a2','cleanupOnlyDeltaVerified':True,'fullSourceLongRunExactMatch':False,'unchangedSimulationRenderingLongRunAccepted':True,'archive':report['archive'],'archiveBytes':report['archiveBytes'],'archiveSha256':report['archiveSha256'],'runtimeInputs':93,'changedFromPreviousDelivery':sorted(changed),'extractedPath':str(extracted),'ordinaryUiCoordinates':'X7.2 Z53.5 / HP79 / quest6 / camp1 / kills3','ordinaryNewJsonDownloaded':False,'milestoneM5Complete':False,'fullGoalComplete':False,'scope':'Two bounded local groups. Production UI/GPU/600s observations use aa9aec2; final r2 differs only by mesh.dispose() in its final cleanup callback, proved by exact whole-file comparison in impact-feedback-audit and separately tested by eight native6-create/6-delete buffer cycles. Final r2 ordinary restore also tested. No repeated600s for unchanged simulation/render/audio/action code; this is explicitly not an exact final-source600s sample. Teleported phases may leave initial region. Not whole-campaign replay, natural animation/boot/weapon collision, audition, true mobile hardware, VRAM or leak freedom.','endurance':{k:run[k] for k in ['activeMs','frames','movingFraction','distanceMeters','hitCount','damageTaken','respawns','p95Ms','maxMs','over50Ms','impactBursts','impactPeak','stepsScheduled','pannersCreated','pannersReleased']},'heapMiB':[round(c['heapBytes']/1048576,2) for c in run['checkpoints']],'gpuP95Ms':{r['label']:[s['gpuMs']['p95'] for s in r['rows']] for r in gpu},'files':{p:sha(p) for p in files}}
    (ROOT/'docs/motion-impact-delivery-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result


if __name__=='__main__':print(json.dumps(verify(),ensure_ascii=False,indent=2))
