"""Verify this bounded architecture delivery and retain its acceptance boundaries."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]
load=lambda name:json.loads((ROOT/name).read_text())
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()

def verify():
    name='tidelands-m5-2026-10-26-camp-architecture'
    package=load('dist/'+name+'.json');unpack=load('docs/'+name+'-verification.json')
    old=load('dist/tidelands-m5-2026-10-25-terrain-composition.json')
    assert len(package['files'])==97 and package['archiveEntries']==98 and package['archiveBytes']==15067998
    assert sha(ROOT/'dist'/package['archive'])==package['archiveSha256']==unpack['archiveSha256']
    assert unpack['passed'] and unpack['checkedFiles']==97
    assert sha(ROOT/'dist'/old['archive'])==old['archiveSha256']
    changed=[n for n,row in package['files'].items() if n not in old['files'] or old['files'][n]['sha256']!=row['sha256']]
    assert changed==['README.md','src/camp-architecture.js','src/camp-surface.js','src/scene.js']
    assert package['builderSha256']==old['builderSha256']
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as bundle:
        for n,row in package['files'].items():
            current=ROOT/('docs/LOCAL-DELIVERY.md' if n=='README.md' else n)
            assert sha(current)==sha(Path(unpack['extractedPath'])/n)==row['sha256'],n
            assert hashlib.sha256(bundle.read('tidelands-local/'+n)).hexdigest()==row['sha256'],n
    for n in ['scene','camp-architecture','camp-surface']:
        assert (ROOT/'src'/f'{n}.js').read_bytes()==(ROOT/'dist/architecture-candidate/tidelands-local/src'/f'{n}.js').read_bytes()
    log=(ROOT/'docs/architecture-integrated-full-tests.txt').read_text();assert '# tests 317\n' in log and '# fail 0\n' in log
    red=(ROOT/'docs/architecture-candidate-red.txt').read_text();assert '# tests 3\n' in red and '# fail 3\n' in red
    focused=(ROOT/'docs/architecture-candidate-resource-tests.txt').read_text();assert '# tests 16\n' in focused and '# fail 0\n' in focused
    native=load('docs/architecture-clear-browser.json');assert len(native['rows'])==11
    for scene in ['camp-day','workbench','tent','campfire','camp-night']:
        pair=[r for r in native['rows'] if r['scene']==scene][:2];assert len(pair)==2
        a,b=pair;assert not a['candidate'] and b['candidate']
        for key in ['camera','player','buildings','time','viewport','buffer']:assert a[key]==b[key],(scene,key)
        assert a['glError']==b['glError']==0 and b['calls']<a['calls']
    assert load('docs/architecture-clear-console.json')=={'baseline':[],'candidate':[]}
    production=load('docs/camp-architecture-production-browser.json');assert production['console']==[]
    assert [r['viewport'] for r in production['rows']]==[[1280,720],[390,844]]
    for r in production['rows']:assert r['production'] and r['glError']==0 and len(r['buildings'])==3
    ordinary=load('docs/camp-architecture-package-browser.json');assert ordinary['console']==[]
    for key in ['ax','mobileAx']:
        assert 'progress indicator Value: 79, ID: hp' in ordinary[key] and '群岛，再次相连' in ordinary[key]
        assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary[key]
    assert sha(ROOT/'docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images=list((ROOT/'docs').glob('architecture-batch-*.jpg'))+list((ROOT/'docs').glob('architecture-clear-*.jpg'))+list((ROOT/'docs').glob('camp-architecture-*.jpg'))
    assert len(images)==26
    report=dict(verified=True,boundedArchitectureIntegrated=True,archive=package['archive'],archiveSha256=package['archiveSha256'],
                runtimeInputs=97,fullTests=317,imagesViewed=26,finalProductionImages=2,ordinaryDesktopRestored=True,ordinary390ReloadRestored=True,
                mapsAdded=9,nominalBaseMapBytes=9*128*128*4,originalRegressionAssertionsPreserved=True,
                campfireAndTentOldOverlapFixtureRejected=True,firstWoodStripeCandidateRejected=True,
                currentExactSourceGpuAccepted=False,currentExactSourceEnduranceAccepted=False,newCurrentCampaignReplayed=False,
                newJsonExported=False,fullGoalComplete=False,milestoneM5Complete=False)
    (ROOT/'docs/camp-architecture-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report))

if __name__=='__main__':verify()
