"""Verify the bounded ridge candidate evidence; never marks the full game complete."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


if __name__ == '__main__':
    cpu = read('docs/highland-ridge-cpu.json')
    for path, digest in cpu['sources'].items():
        assert sha(path) == digest, 'Production source changed after the CPU/browser checkpoint'
    assert cpu['identitiesPreserved'] and cpu['counts'] == {'resources': 573, 'enemies': 79}
    assert cpu['oldPlants']['outsideSha256'] == cpu['newPlants']['outsideSha256']
    assert cpu['oldPlants']['outsideCount'] == cpu['newPlants']['outsideCount'] == 111082
    assert cpu['changedWater'] == 0 and cpu['maxDeltaGradient'] < 1 and cpu['maxRiseAt30fps'] < 1.9
    assert all(o['before'] == o['current'] for o in cpu['landmarkHeights'])
    before = read('docs/ridge-before-browser.json')
    current = read('docs/ridge-current-browser.json')
    assert current['console'] == []
    signature = lambda row: json.dumps([row['state'][key] for key in ('scene', 'startTime', 'pitch', 'viewport')])
    original = {signature(row): row for row in before if row['state'].get('pitch') == .08}
    matched = [row for row in current['rows'] if row['state']['frames'] == 0 and signature(row) in original]
    assert len(matched) == 5
    for row in matched:
        assert row['state']['position'] == original[signature(row)]['state']['position']
        assert row['state']['pitch'] == .08
    moving = [row['state'] for row in current['rows'] if row['state']['frames']]
    assert len(moving) == 2
    for row in moving:
        assert row['frames'] == 180 and not row['running'] and not row['hidden']
        assert row['distance'] > 18 and len(row['poses']) == 6
        assert row['raf']['samples'] == 179
    evidence = before + current['rows']
    for row in evidence:
        assert row['state']['glError'] == 0
        assert (ROOT / row['image']).read_bytes().startswith(b'\xff\xd8\xff')
    for path, count in [('docs/highland-ridge-focused-tests.txt', 24), ('docs/highland-ridge-full-tests.txt', 257)]:
        text = (ROOT / path).read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    preserved = {'dist/tidelands-m5-2026-10-18-beacon-footing.zip': '2d922da8581be03234e0b721cf7f5561b8d0612a5093ac55f82b5330b33ae5ca',
                 'docs/beacon-footing-normal-save.json': '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'}
    for path, digest in preserved.items():
        assert sha(path) == digest
    report = {'boundedRidgeChecksPassed': True, 'sources': cpu['sources'], 'matchedStaticViews': 5,
              'images': {row['image']: sha(row['image']) for row in evidence}, 'motionFrames': 360,
              'actualMovementMetres': [row['distance'] for row in moving], 'motionHp': [row['hp'] for row in moving],
              'preservedFiles': preserved, 'ordinaryJourneyReplayed': False, 'newPackageDelivered': False,
              'currentSourceGpuOrEnduranceVerified': False, 'fullM5Complete': False, 'fullGoalComplete': False,
              'scope': 'Source, CPU, tests and bounded declared-fixture browser evidence only; visual judgment remains in HIGHLAND-RIDGE-REVIEW.md. No ordinary NPC/ruin route, full cast naturalness, physical device, audio or full quality acceptance.'}
    (ROOT / 'docs/highland-ridge-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': True, 'matchedViews': 5, 'images': len(evidence), 'motionFrames': 360, 'fullGoalComplete': False}))
