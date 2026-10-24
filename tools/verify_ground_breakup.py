"""Validate retained evidence for a rejected isolated surface experiment."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
load = lambda p: json.loads((ROOT / p).read_text())


def verify():
    evidence = load('docs/ground-breakup-browser.json')
    assert evidence['console'] == [] and len(evidence['rows']) == 11
    rows = {r['name']: r for r in evidence['rows']}
    for name, row in rows.items():
        assert row['glError'] == 0 and row['ready'] and not row['hidden'] and not row['running'], name
        for n, digest in row['sources'].items():
            assert sha(ROOT / n) == digest, n
        # QA toolbar occupies height; validate against actual canvas, not viewport.
        ratio = row['buffer'][0] / row['canvas']['width']
        assert abs(row['buffer'][1] - row['canvas']['height'] * ratio) <= 1
    for prefix in ['coast', 'forest', 'highland', 'shoal', 'mobile-camp-night']:
        before, after = rows[prefix + '-baseline'], rows[prefix + '-candidate']
        for key in ['place', 'position', 'camera', 'time', 'weather', 'viewport', 'buffer', 'canvas', 'render', 'sources']:
            assert before[key] == after[key], (prefix, key)
        assert before['surface'] == 'baseline' and after['surface'] == 'candidate'
    assert rows['mobile-camp-night-candidate']['viewport'] == [390, 844]
    assert rows['mobile-camp-night-candidate']['time'] == 0
    movement = rows['forest-candidate-walk']
    assert movement['frames'] == 180 and abs(movement['distance'] - 21) < .00001
    assert movement['raf']['p95'] < 25 and movement['raf']['max'] < 50
    package = load('dist/tidelands-m5-2026-10-24-hud-field.json')
    assert sha(ROOT / 'dist' / package['archive']) == package['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        for n, row in package['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if n == 'README.md' else n)
            assert sha(source) == row['sha256'], n
            assert hashlib.sha256(archive.read('tidelands-local/' + n)).hexdigest() == row['sha256'], n
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images = sorted((ROOT / 'docs').glob('ground-breakup-*.jpg'))
    assert len(images) == 11 and all(n.read_bytes()[:2] == b'\xff\xd8' for n in images)
    files = [*sorted((ROOT / 'docs').glob('ground-breakup-*')), ROOT / 'tests/ground-breakup-candidate.js',
             ROOT / 'tests/ground-breakup-review.html', ROOT / 'docs/GROUND-BREAKUP-PLAN.md',
             ROOT / 'docs/GROUND-BREAKUP-REVIEW.md', ROOT / 'tools/verify_ground_breakup.py']
    report = dict(verified=True, candidateAccepted=False, productionIntegrated=False, reason='Small colour/texture variation does not resolve smooth bare slopes or spatial silhouettes; stop noise iteration.',
                  samePositionPairs=5, imagesViewed=11, movementFrames=180, movementDistance=movement['distance'],
                  movementRaf=movement['raf'], productionInputsUnchanged=len(package['files']),
                  productionArchiveSha256=package['archiveSha256'], currentExactSourceGpuAccepted=False,
                  newOrdinaryJourneyVerified=False, newRuleTestRun=False, milestoneM5Complete=False, fullGoalComplete=False,
                  scope='Rejected surface-only candidate. Shader amount-zero baseline, QA canvas smaller than viewport, short declared movement, no performance or final-quality claim.',
                  files={str(n.relative_to(ROOT)): sha(n) for n in files if n.name != 'ground-breakup-audit.json'})
    (ROOT / 'docs/ground-breakup-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['verified', 'candidateAccepted', 'productionIntegrated', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
