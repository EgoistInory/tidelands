"""Audit the bounded support fix and keep the terrain integration boundary explicit."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
load = lambda p: json.loads((ROOT / p).read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def verify():
    before = load('docs/terrain-support-before-trace.json')
    after = load('docs/terrain-locomotion-trace.json')
    original_plane = load('docs/terrain-support-original-plane-trace.json')
    current_plane = load('docs/terrain-support-plane-trace.json')
    assert after['sources']['src/character.js'] == current_plane['sources']['src/character.js'] == sha(ROOT / 'src/character.js')
    assert before['sources']['src/character.js'] == original_plane['sources']['src/character.js']
    assert original_plane['original'] and not current_plane['original']
    assert [r['fps'] for r in after['rows']] == [30, 60, 144]
    assert all(a['minimum'] > -.6 and b['minimum'] < -.6 for a, b in zip(after['rows'], before['rows']))
    assert all(a['minimum'] == b['minimum'] for a, b in zip(original_plane['rows'], current_plane['rows']))
    for file, count, fail in [('red', 2, 1), ('first-fix', 24, 1), ('second-fix', 24, 3), ('focused', 24, 0), ('full-tests', 311, 0)]:
        s = (ROOT / ('docs/terrain-support-' + file + '.txt')).read_text()
        assert '# tests ' + str(count) + '\n' in s and '# fail ' + str(fail) + '\n' in s
    package = load('dist/tidelands-m5-2026-10-24-hud-field.json')
    assert sha(ROOT / 'dist' / package['archive']) == package['archiveSha256']
    changed = []
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        for n, row in package['files'].items():
            p = ROOT / ('docs/LOCAL-DELIVERY.md' if n == 'README.md' else n)
            if sha(p) != row['sha256']:
                changed.append(n)
        old = archive.read('tidelands-local/src/character.js').decode()
        assert hashlib.sha256(old.encode()).hexdigest() == before['sources']['src/character.js']
    assert changed == ['src/character.js']
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    assert not (ROOT / 'src/terrain-composition.js').exists()
    files = [*sorted((ROOT / 'docs').glob('terrain-support-*')), ROOT / 'docs/terrain-locomotion-trace.json',
             ROOT / 'docs/TERRAIN-SUPPORT-CHECKPOINT.md', ROOT / 'src/character.js', ROOT / 'tests/terrain-locomotion.test.js',
             ROOT / 'tools/trace_terrain_locomotion.mjs', ROOT / 'tools/verify_terrain_support.py']
    report = dict(verified=True, boundedOriginalTerrainRegressionFixed=True, terrainProductionIntegrated=False,
                  focusedTests=24, fullTests=311, candidateMinimumPelvis=[r['minimum'] for r in after['rows']],
                  historicalPlaneDownIssueUnresolved=True, currentNewPackage=False, browserQualityAccepted=False,
                  currentExactSourceGpuAccepted=False, currentExactSourceEnduranceAccepted=False,
                  fullGoalComplete=False, milestoneM5Complete=False,
                  files={str(p.relative_to(ROOT)): sha(p) for p in files if p.name != 'terrain-support-audit.json'})
    (ROOT / 'docs/terrain-support-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['verified', 'boundedOriginalTerrainRegressionFixed', 'terrainProductionIntegrated', 'fullTests', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
