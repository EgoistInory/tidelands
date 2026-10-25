"""Audit persisted ordinary-UI journey evidence against the frozen local delivery.

This checks recorded facts, not unattended combat quality or a complete input replay.
"""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'ordinary-journey-20261025-'
load = lambda path: json.loads((ROOT / path).read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    package = load('dist/tidelands-m5-2026-10-25-terrain-composition.json')
    archive = ROOT / 'dist' / package['archive']
    assert sha(archive) == package['archiveSha256']
    assert len(package['files']) == 95
    with zipfile.ZipFile(archive) as bundle:
        for name, item in package['files'].items():
            current = ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)
            assert sha(current) == item['sha256'], name
            assert hashlib.sha256(bundle.read('tidelands-local/' + name)).hexdigest() == item['sha256'], name
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    harness = (ROOT / 'tests/current-ordinary-journey.html').read_text()
    assert "boot({storageKey:key})" in harness and 'initialState' not in harness
    assert 'tidelands-acceptance-20261025-run1' in harness
    names = ['botanist', 'two-kills', 'explorer', 'beacon', 'reload']
    states = {name: load('docs/' + PREFIX + name + '-state.json') for name in names}
    for state in states.values():
        assert state['storageKey'] == 'tidelands-acceptance-20261025-run1'
        assert state['glError'] == 0 and state['inventory']['axe'] == 1
        assert len(state['buildings']) == 1 and state['buildings'][0]['type'] == 'campfire'
    botanist, combat, explorer, beacon, reload = [states[name] for name in names]
    assert botanist['quest'] == 4 and botanist['kills'] == 0
    assert combat['quest'] == 4 and combat['kills'] == 2
    for enemy_id in ['enemy-37', 'enemy-13']:
        assert next(enemy for enemy in combat['enemies'] if enemy['id'] == enemy_id)['hp'] <= 0
    assert explorer['quest'] == 5 and explorer['inventory']['crystal'] == 2
    assert beacon['quest'] == reload['quest'] == 6 and beacon['kills'] == reload['kills'] == 2
    assert beacon['inventory'] == reload['inventory'] == dict(wood=1, stone=2, fiber=4, berry=6, shell=0, crystal=0, axe=1, sword=0, meal=0)
    assert beacon['player'] == reload['player'] and beacon['buildings'] == reload['buildings']
    assert beacon['player']['hp'] == 88
    rows = [json.loads(line) for line in (ROOT / 'docs' / (PREFIX + 'inputs.jsonl')).read_text().splitlines()]
    assert rows[0]['event'] == 'resumed-after-controller-timeout'
    assert any(row.get('event') == 'explicit-save-ui' for row in rows)
    assert rows[-1]['event'] == 'explicit-save-reload-continue'
    images = ['campfire', 'botanist', 'two-kills', 'beacon']
    for name in images:
        assert (ROOT / 'docs' / (PREFIX + name + '.jpg')).stat().st_size > 10000
    report = dict(verified=True, frozenRuntimeInputs=95, packageSha256=package['archiveSha256'],
                  independentOrdinaryKey=beacon['storageKey'], ordinaryUiPathReachedQuest=6,
                  actualKills=2, explicitSaveReloadRestored=True, imagesViewed=4,
                  inputJournalRows=len(rows), completeInputTrace=False,
                  knownRespawns=2, controllerPausesUsed=True, uninterruptedJourneyAccepted=False,
                  jsonExportDownloadVerified=False, mobileJourneyReplayed=False,
                  currentExactSourceGpuAccepted=False, currentExactSourceEnduranceAccepted=False,
                  milestoneM5Complete=False, fullGoalComplete=False)
    (ROOT / 'docs/ordinary-journey-20261025-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    verify()
