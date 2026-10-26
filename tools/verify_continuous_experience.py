"""Check current-source ordinary exploration evidence without claiming final quality."""
from pathlib import Path
import hashlib
import json
import math
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'docs/continuous-experience-20261026'


def load(suffix):
    return json.loads((ROOT / (PREFIX + suffix)).read_text())


def verify():
    package = json.loads((ROOT / 'dist/tidelands-m5-2026-10-26-build-clearance.json').read_text())
    digest = lambda data: hashlib.sha256(data).hexdigest()
    archive = ROOT / 'dist' / package['archive']
    assert digest(archive.read_bytes()) == package['archiveSha256']
    with zipfile.ZipFile(archive) as bundle:
        for name, row in package['files'].items():
            path = ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)
            assert digest(path.read_bytes()) == row['sha256'], name
            assert digest(bundle.read('tidelands-local/' + name)) == row['sha256'], name
    before, saved, restored = load('-before.json'), load('-saved.json'), load('-restored.json')
    for key in ['player', 'inventory', 'quest', 'kills', 'buildings', 'depleted', 'selected', 'respawn']:
        assert saved[key] == restored[key], key
    rows = [json.loads(line) for line in (ROOT / (PREFIX + '-inputs.jsonl')).read_text().splitlines()]
    assert len(rows) == 43 and rows[0]['kind'] == 'resume-current-source'
    harness = (ROOT / 'tests/current-ordinary-journey.html').read_text()
    assert 'boot({storageKey:key})' in harness and 'initialState' not in harness
    assert rows[11]['before']['player']['x'] == -70 and rows[11]['before']['player']['z'] == 102
    assert rows[10]['after']['player']['hp'] == 100
    assert math.hypot(rows[10]['after']['player']['x'] + 70,
                      rows[10]['after']['player']['z'] - 102) > 30
    keys = rows[1:]
    assert len(keys) == 42 and all(r['kind'] == 'native-key' for r in keys)
    assert before['quest'] == saved['quest'] == 6 and before['kills'] == 2 and saved['kills'] == 3
    assert before['buildings'] == saved['buildings']
    assert before['inventory']['wood'] == 1 and saved['inventory']['wood'] == 7
    assert saved['inventory']['fiber'] == 6 and saved['inventory']['berry'] == 7
    assert saved['player']['hp'] == 100 and saved['selected'] == 'axe'
    enemy = lambda state: next(e for e in state['enemies'] if e['id'] == 'enemy-60')
    hits = [r for r in keys if r['key'] == 'space' and enemy(r['after'])['hp'] < enemy(r['before'])['hp']]
    assert [enemy(r['after'])['hp'] for r in hits] == [47, 24, 1, -22]
    assert [r['after']['player']['hp'] for r in hits] == [88, 76, 64, 64]
    assert hits[-1]['after']['kills'] == 3
    rests = [r for r in keys if r['key'] == 'e' and r['before']['near'] and r['before']['near']['type'] == 'campfire']
    assert [(r['before']['player']['hp'], r['after']['player']['hp']) for r in rests] == [(88, 100), (64, 100)]
    assert all(r['before']['inventory'] == r['after']['inventory'] for r in rests)
    assert all(r['after']['glError'] == 0 for r in keys)
    assert load('-console.json') == [] and restored['viewport'] == [390, 844]
    images = list((ROOT / 'docs').glob('continuous-experience-20261026-*.jpg'))
    assert len(images) == 7 and all(p.stat().st_size > 10000 for p in images)
    distance = sum(math.hypot(r['after']['player']['x'] - r['before']['player']['x'],
                              r['after']['player']['z'] - r['before']['player']['z']) for r in keys)
    report = dict(verified=True, runtimeInputs=len(package['files']), packageSha256=package['archiveSha256'],
                  nativeKeys=42, heldInputMs=sum(r['ms'] for r in keys), imagesViewed=7,
                  sampledSimulationSpan=keys[-1]['after']['time'] - rows[0]['state']['time'],
                  inputEndpointMovementMetres=distance, ordinaryContinuation=True, injectedState=False,
                  gatheredTrees=2, nativeBoarDefeated=True, campRests=2, ordinary390SaveRestore=True,
                  controllerIdleRespawnObserved=True, treeBlockedControllerAttemptRetained=True,
                  pausesAfterTraceRows=[32, 39, 42], completeContinuousCampaign=False,
                  frameByFrameMotionAudit=False, audioListening=False, gpuOrEnduranceAccepted=False,
                  realDeviceVerified=False, milestoneM5Complete=False, fullGoalComplete=False)
    (ROOT / (PREFIX + '-audit.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    verify()
