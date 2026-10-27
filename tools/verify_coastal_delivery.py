"""Audit the exact coastal runtime, local archive and independent ordinary-save evidence."""
from pathlib import Path
import hashlib,json,math,zipfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-27-coastal-contact-budget'
def load(name):return json.loads((ROOT/name).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    package=load(f'dist/{NAME}.json');unpack=load(f'docs/{NAME}-verification.json');old=load('dist/tidelands-m5-2026-10-27-cast-clothing.json');extracted=Path(unpack['extractedPath']);archive=ROOT/'dist'/package['archive']
    assert package['archiveBytes']==archive.stat().st_size==66215160 and sha(archive)==package['archiveSha256']==unpack['archiveSha256']
    assert len(package['files'])==unpack['checkedFiles']==181 and package['archiveEntries']==182 and unpack['passed']
    assert sha(ROOT/'tools/package_local.py')==package['builderSha256'] and set(old['files']).issubset(package['files'])
    changed={n for n in old['files'] if old['files'][n]['sha256']!=package['files'][n]['sha256']}
    assert changed=={'README.md','src/game.js','src/impact-feedback.js','src/main.js','src/resource-contact.js','src/scene.js'}
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        for name,row in package['files'].items():
            p=ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)
            assert sha(p)==sha(extracted/name)==row['sha256'] and hashlib.sha256(bundle.read('tidelands-local/'+name)).hexdigest()==row['sha256']
    source=load('assets/coastal/provenance.json');assert source['license']=='CC0-1.0' and len(source['files'])==65
    for name,row in source['files'].items():
        p=ROOT/'assets/coastal'/name;assert sha(p)==row['sha256'] and p.stat().st_size==row['bytes']
        if name!='LICENSE.txt':assert sha(ROOT/'dist/canopy-authored-candidate'/name)==row['sha256']
    for name in ['game.js','resource-contact.js','impact-feedback.js','resource-footprint.js']:
        assert sha(ROOT/'src'/name)==sha(ROOT/'dist/coastal-contact-r2/tidelands-local/src'/name)
    for name in ['coastal-far-batches.js','coastal-level-budget.js']:assert sha(ROOT/'src'/name)==sha(ROOT/'tests'/name)
    log=(ROOT/'docs/coastal-production-full-tests.txt').read_text();assert '# pass 352\n' in log and '# fail 0\n' in log
    assert 'Ran 7 tests' in (ROOT/'docs/coastal-production-packaging.txt').read_text() and (ROOT/'docs/coastal-production-packaging.txt').read_text().rstrip().endswith('OK')
    rows=load('docs/coastal-production-main-rows.json');start,blocked,cut,passed=rows
    assert start['player']['x']==blocked['player']['x'] and start['player']['z']==blocked['player']['z']
    assert cut['inventory']['wood']==33 and cut['targetDepleted'] and not cut['targetVisible'] and passed['player']['z']-cut['player']['z']>5
    build=load('docs/coastal-production-build-rows.json')
    for case in ['clear','depleted','legacy']:
        before,after=[next(r for r in build if r['case']==case and r['step']==step) for step in ['before','after']]
        if case=='clear':assert len(after['buildings'])==1 and after['inventory']['wood']==25 and after['inventory']['stone']==27
        elif case=='depleted':assert after['inventory']==before['inventory'] and not after['buildings'] and '恢复' in after['placement']['error']
        else:assert before['player']['hp']==62 and after['player']['hp']==100 and after['targetDepleted'] and not after['targetVisible'] and before['buildings']==after['buildings']
    for row in rows+build:assert row['coastalNodes']==133 and row['worldUnchanged'] and row['glError']==0
    original=load('docs/coastal-production-ordinary-input.json');restored=load('docs/coastal-delivery-restored.json');saved=load('docs/coastal-delivery-saved.json');reloaded=load('docs/coastal-delivery-reloaded.json')
    keys=['player','inventory','buildings','depleted','quest','kills','time','respawn','selected']
    for key in keys:assert original[key]==restored['state'][key] and saved['state'][key]==reloaded['state'][key]
    assert restored['state']['enemies']==original['enemies'] and len(original['enemies'])==79 and original['kills']==3 and original['quest']==6
    rested=load('docs/coastal-delivery-rested.json');moved=load('docs/coastal-delivery-moved.json');orbited=load('docs/coastal-delivery-orbited.json');narrow=load('docs/coastal-delivery-narrow.json')
    # Campfire interaction restores health without skipping the simulation clock.
    # This ordinary save starts full; actual 62->100 healing is the legacy fixture above.
    assert rested['state']['buildings']==original['buildings'] and rested['state']['inventory']==original['inventory'] and rested['state']['player']['hp']==rested['state']['player']['stamina']==100 and rested['near']['type']=='campfire'
    distance=math.hypot(moved['state']['player']['x']-original['player']['x'],moved['state']['player']['z']-original['player']['z']);assert distance>5 and moved['camera']!=orbited['camera']
    for row in [restored,saved,reloaded,rested,moved,orbited,narrow]:assert row['coastalNodes']==133 and row['glError']==0
    assert narrow['viewport']==narrow['buffer']==[390,844]
    preservation=load('docs/coastal-production-original-preservation.json');assert preservation['unchanged'] and preservation['sha256']==hashlib.sha256((ROOT/'docs/coastal-production-ordinary-input.json').read_text().strip().encode()).hexdigest()
    assert sha(ROOT/'docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    assert load('docs/coastal-production-console.json')==load('docs/coastal-delivery-console.json')==[]
    fallback=load('docs/coastal-production-fallback.json');assert '部分海岸' in fallback['status'] and not fallback['state'].get('coastalNodes') and fallback['state']['glError']==0
    images=['coastal-production-fallback.png','coastal-production-main-passage.png','coastal-production-clear.png','coastal-production-depleted.png','coastal-production-legacy.png','coastal-delivery-ordinary-clean.png','coastal-delivery-saved.png','coastal-delivery-narrow.png']
    for name in images:
        with Image.open(ROOT/'docs'/name) as im:assert im.size==((390,844) if name.endswith('narrow.png') else (1280,720))
    report=dict(verified=True,productionIntegrated=True,finiteCoastalIncrementDelivered=True,package=package['archive'],packageSha256=package['archiveSha256'],packageBytes=package['archiveBytes'],runtimeFiles=181,archiveEntries=182,coastalFiles=66,coastalBytes=sum(r['bytes'] for r in source['files'].values()),sourceModels=3,coastalResourceIds=133,nearLimit=1,midLimit=3,rootTestsPassed=352,packagingTestsPassed=7,exactR2CorePromoted=True,independentPackageNativeStartupAccepted=True,ordinaryInputNineFieldsRestored=True,ordinaryEnemyRecordsPreserved=79,ordinarySaveNineFieldsReloaded=True,ordinaryNativeMovementDistance=distance,ordinaryCampInteractionExecuted=True,ordinaryCampHealingSeparatelyVerifiedInLegacyFixture=True,ordinaryOrbitAccepted=True,narrowViewport=[390,844],productionNativeGatherPassage=passed['player']['z']-cut['player']['z'],productionBuildRegressionsAccepted=True,originalOrdinarySaveUnchanged=True,nativeAcceptedImagesViewed=8,localAssetFailureFallbackAccepted=True,rejectedHarnessOverlayImagePreserved='coastal-delivery-ordinary-start.png',temporaryServerStopped=True,temporaryServerExitCode=1,temporaryServerStopReason='Expected Ctrl-C KeyboardInterrupt after temporary loopback verification',currentGpuOrEnduranceAccepted=False,seamlessLodQualityAccepted=False,physicalDeviceVerified=False,audioListeningVerified=False,milestoneM5Complete=False,fullGoalComplete=False,images={name:sha(ROOT/'docs'/name) for name in images})
    (ROOT/'docs/coastal-production-delivery-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False))
if __name__=='__main__':verify()
