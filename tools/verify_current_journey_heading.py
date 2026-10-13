"""Verify ordinary quest 3-to-5 evidence; this is not a full-game quality audit."""
import hashlib
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT / name).read_text())
def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()

def verify():
    review = read('docs/current-journey-heading-review.json')
    package = read('dist/tidelands-m5-2026-10-12-movement-heading.json')
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    previous = read('docs/movement-heading-review.json')
    for name, digest in previous['sourceSha256'].items():
        assert sha(name) == digest, name
    for name, digest in review['imagesViewedSha256'].items():
        assert sha(name) == digest, name
    ui = read('docs/current-journey-heading-ui.json')
    combat = read('docs/current-journey-heading-combat-ui.json')
    assert ui['sameOrdinarySave'] and not ui['newFixtureImported'] and not ui['runtimeStateEdited'] and not ui['console']
    assert ui['start']['quest'] == '林间的来信' and ui['crossing']['region'] == '群岛海域'
    assert ui['botanist']['quest'] == '雾岬的回声'
    assert combat['ordinaryGameRules'] and not combat['newFixtureImported'] and not combat['runtimeStateEdited'] and not combat['console']
    assert combat['firstBoarCorrectedHit']['enemy'] == '47 / 70'
    for hits, count in [(combat['firstBoarFinalHits'], 1), (combat['secondBoarVerifiedHits'], 2)]:
        assert [h['enemy'] for h in hits[:-1]] == (['24 / 70', '1 / 70'] if count == 1 else ['47 / 70', '24 / 70', '1 / 70'])
        assert hits[-1]['enemyHidden'] and f'击败 {count}' in hits[-1]['coordinates']
    missed = read('docs/current-journey-heading-miss-save.json')
    p = missed['player']
    e = min((e for e in missed['enemies'] if e['hp'] > 0), key=lambda e: math.hypot(e['x']-p['x'], e['z']-p['z']))
    dx, dz = e['x']-p['x'], e['z']-p['z']
    distance = math.hypot(dx, dz)
    dot = (dx*math.sin(p['yaw'])+dz*math.cos(p['yaw']))/distance
    assert distance < 2.6 and dot < .35 and missed['selected'] == 'axe'
    assert combat['explorer']['quest'] == '让灯塔重新发光'
    state = read('docs/current-journey-heading-q5-save.json')
    export = read('docs/current-journey-heading-q5-export.json')
    assert sha('docs/current-journey-heading-q5-save.json') == export['sha256']
    assert state['quest'] == 5 and state['kills'] == 2 and len(state['buildings']) == 1
    assert state['inventory'] == {'wood':4,'stone':1,'fiber':4,'berry':0,'shell':0,'crystal':1,'axe':1,'sword':0,'meal':0}
    restore = subprocess.run(['node','--input-type=module','-e',"import {restore} from './src/game.js'; import {readFileSync} from 'node:fs'; const s=restore(readFileSync('docs/current-journey-heading-q5-save.json','utf8')); console.log(JSON.stringify({quest:s.quest,kills:s.kills,hp:s.player.hp}));"], cwd=ROOT, check=True, text=True, capture_output=True)
    restored = json.loads(restore.stdout)
    assert restored == {'quest':5,'kills':2,'hp':state['player']['hp']}
    report = {'kind':'ordinary-main-path-progress-audit','passed':True,'fullCurrentJourneyComplete':False,'fullGoalComplete':False,'milestoneM5Complete':False,'productionUnchangedFromPackage':True,'previousGoalTurnClassification':'progress','reusedPreviousSourceBindings':len(previous['sourceSha256']),'viewedImages':len(review['imagesViewedSha256']),'missExplanation':{'distance':distance,'facingDot':dot,'requiredFacingDot':.35},'final':export,'restoreVerified':restored,'limits':review['limits'],'evidenceSha256':{str(f.relative_to(ROOT)):sha(f.relative_to(ROOT)) for f in sorted((ROOT/'docs').glob('current-journey-heading-*')) if f.name!='current-journey-heading-audit.json'}}
    (ROOT/'docs/current-journey-heading-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':True,'quest':5,'kills':2,'hp':state['player']['hp'],'fullCurrentJourneyComplete':False,'fullGoalComplete':False},ensure_ascii=False))

if __name__ == '__main__':
    verify()
