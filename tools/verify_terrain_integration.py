"""Verify the bounded integrated terrain package and its actual acceptance evidence."""
from pathlib import Path
import hashlib
import json
import re
import zipfile
ROOT=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((ROOT/p).read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

def verify():
    name='tidelands-m5-2026-10-25-terrain-composition'
    package=load('dist/'+name+'.json');unpack=load('docs/'+name+'-verification.json')
    old=load('dist/tidelands-m5-2026-10-24-hud-field.json')
    assert len(package['files'])==95 and package['archiveEntries']==96 and package['archiveBytes']==15064826
    assert sha(ROOT/'dist'/package['archive'])==package['archiveSha256']==unpack['archiveSha256']
    assert unpack['passed'] and unpack['checkedFiles']==95
    assert sha(ROOT/'dist'/old['archive'])==old['archiveSha256']
    changed=[n for n,row in package['files'].items() if n not in old['files'] or old['files'][n]['sha256']!=row['sha256']]
    assert changed==['README.md','src/character.js','src/terrain-composition.js','src/world.js']
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as archive:
        assert archive.testzip() is None
        for n,row in package['files'].items():
            current=ROOT/('docs/LOCAL-DELIVERY.md' if n=='README.md' else n)
            assert sha(current)==sha(Path(unpack['extractedPath'])/n)==row['sha256'],n
            assert hashlib.sha256(archive.read('tidelands-local/'+n)).hexdigest()==row['sha256'],n
    assert (ROOT/'src/terrain-composition.js').read_text().split('\n',1)[1]==(ROOT/'tests/terrain-composition-candidate.js').read_text().split('\n',1)[1]
    snapshot=ROOT/'dist/terrain-composition-candidate/tidelands-local/src/world.js'
    assert (ROOT/'src/world.js').read_text()==snapshot.read_text().replace("'./terrain-composition-candidate.js'","'./terrain-composition.js'")
    log=(ROOT/'docs/terrain-integration-full-tests.txt').read_text();assert '# tests 314\n' in log and '# fail 0\n' in log
    preflight=(ROOT/'docs/terrain-integration-preflight-tests.txt').read_text();assert '# fail 4\n' in preflight
    native=load('docs/terrain-integration-browser.json');assert len(native['rows'])==4 and native['console']==[]
    for row in native['rows']:
        assert row['glError']==0
        for n,digest in row['sources'].items():assert sha(ROOT/n)==digest,n
    move=native['rows'][2];assert move['frames']==180 and not move['hidden'] and abs(move['distance']-18.55)<.0001
    assert native['rows'][3]['viewport']==[390,844] and native['rows'][3]['buffer']==[390,722]
    ordinary=load('docs/terrain-integration-package-browser.json');assert ordinary['console']==[]
    for key in ['ax','mobileAx']:
        assert 'progress indicator Value: 79, ID: hp' in ordinary[key] and '群岛，再次相连' in ordinary[key]
        assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary[key]
    for item,count in [('木材',4),('石料',5),('纤维',6),('浆果',3),('石斧',1)]:
        assert re.search(r'text '+item+r'\n\s+\d+ text '+str(count)+r'\n',ordinary['bagAx'])
    assert sha(ROOT/'docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images=list((ROOT/'docs').glob('terrain-integration-*.jpg'));assert len(images)==6
    report=dict(verified=True,boundedTerrainIntegrated=True,archive=package['archive'],archiveSha256=package['archiveSha256'],
                runtimeInputs=95,fullTests=314,imagesViewed=6,ordinaryDesktopRestored=True,ordinary390ReloadRestored=True,
                newManualSaveVerified=False,newJsonExported=False,currentFullCampaignReplayed=False,
                currentExactSourceGpuAccepted=False,currentExactSourceEnduranceAccepted=False,fullGoalComplete=False,milestoneM5Complete=False)
    (ROOT/'docs/terrain-integration-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report))

if __name__=='__main__':verify()
