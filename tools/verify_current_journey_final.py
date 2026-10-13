"""Verify real ordinary ending evidence; not a final M5 or 3A quality audit."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT / name).read_text())
def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()

def verify():
    ui = read('docs/current-journey-final-ui.json')
    assert ui['sameOrdinarySave'] and not ui['newFixtureImported'] and not ui['runtimeStateEdited']
    assert not ui['console'] and not ui['fullGoalComplete'] and not ui['milestoneM5Complete']
    previous = read('docs/movement-heading-review.json')
    for name, digest in previous['sourceSha256'].items():
        assert sha(name) == digest, name
    package = read('dist/tidelands-m5-2026-10-12-movement-heading.json')
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    steps = ui['steps']
    before = next(s for s in steps if s['step'] == 'all lamp materials collected normally before hand-in')
    after = next(s for s in steps if s['step'].startswith('actual lamp hand-in'))
    counts = lambda s: {i['name']: int(i['count']) for i in s['inventory']}
    a, b = counts(before), counts(after)
    assert before['quest'] == '让灯塔重新发光' and after['quest'] == '群岛，再次相连'
    assert {k: a[k] - b[k] for k in ['木材', '石料', '晶石']} == {'木材':12, '石料':8, '晶石':3}
    walk = next(s for s in steps if s['step'] == 'ordinary free exploration after ending')
    assert walk['coordinates'] != after['coordinates'] and walk['quest'] == after['quest']
    mobile = next(s for s in steps if s['step'] == '390x844 actual browser ending restore')
    assert mobile['layout'] == {'width':390, 'height':844, 'scrollWidth':390}
    assert mobile['quest'] == after['quest'] and mobile['hp'] == '100'
    snapshots = {}
    for name in ['docs/current-journey-final-handoff-save.json', 'docs/current-journey-final-camp-save.json']:
        state = read(name)
        assert state['quest'] == 6 and state['kills'] == 2 and len(state['buildings']) == 1
        assert (state['inventory']['wood'], state['inventory']['stone'], state['inventory']['crystal']) == (4,2,0)
        cmd = ['node','--input-type=module','-e', "import {restore} from './src/game.js'; import {readFileSync} from 'node:fs'; console.log(JSON.stringify(restore(readFileSync(process.argv[1],'utf8'))));", name]
        result = subprocess.run(cmd, cwd=ROOT, check=True, text=True, capture_output=True)
        restored = json.loads(result.stdout)
        assert restored['quest'] == state['quest'] and restored['player'] == state['player']
        assert restored['inventory'] == state['inventory']
        snapshots[name] = {'bytes': (ROOT/name).stat().st_size, 'sha256':sha(name), 'player':state['player'], 'inventory':state['inventory']}
    final = read('docs/current-journey-final-camp-save.json')
    assert final['player']['hp'] == 100 and final['player']['x'] == -70 and final['player']['z'] == 102
    assert final['inventory']['berry'] == 2 and counts(mobile)['浆果'] == 2
    images = {str(p.relative_to(ROOT)):sha(p.relative_to(ROOT)) for p in sorted((ROOT/'docs').glob('current-journey-final-*.jpg'))}
    assert len(images) == 10
    report = {'passed':True, 'kind':'ordinary-current-version-functional-main-path-closure', 'fullCurrentJourneyFunctionalComplete':True, 'fullGoalComplete':False, 'milestoneM5Complete':False, 'productionSourceBindingsVerified':len(previous['sourceSha256']), 'packageSha256':package['archiveSha256'], 'exactDebits':{'wood':12,'stone':8,'crystal':3}, 'rawOrdinaryExportsRestored':snapshots, 'imagesViewedSha256':images, 'limits':ui['limits'], 'previousEvidence':['docs/movement-heading-final-audit.json','docs/current-journey-heading-audit.json'], 'uiSha256':sha('docs/current-journey-final-ui.json')}
    (ROOT/'docs/current-journey-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'passed':True,'quest':6,'hp':100,'sameOrdinaryJourney':True,'fullGoalComplete':False}, ensure_ascii=False))

if __name__ == '__main__':
    verify()
