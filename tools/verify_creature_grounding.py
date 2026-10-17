"""Audit the bounded creature slope candidate, not full locomotion quality."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def verify():
    baseline = json.loads((ROOT / 'dist/tidelands-m5-2026-10-16-ecosystem.json').read_text())
    changed = [p for p, value in baseline['files'].items()
               if sha('docs/LOCAL-DELIVERY.md' if p == 'README.md' else p) != value['sha256']]
    assert set(changed) == {'src/creature.js', 'src/scene.js'}, changed
    assert sha('dist/' + baseline['archive']) == baseline['archiveSha256']
    for label, count in [('tests', 232), ('focused', 22)]:
        text = (ROOT / f'docs/creature-grounding-{label}.txt').read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    red = (ROOT / 'docs/creature-grounding-corrected-red.txt').read_text()
    assert '# tests 2\n' in red and '# fail 2\n' in red
    rendered = json.loads((ROOT / 'docs/creature-grounding-render.json').read_text())
    rows = rendered['rows']
    assert len(rows) == 12 and not rendered['console']
    assert all(r['glError'] == 0 for r in rows)
    for kind in ['boar', 'crab']:
        for region in ['coast', 'forest', 'highland', 'shoal']:
            assert any(r['region'] == region and r['type'] == kind and r['frames'] == 0 for r in rows)
        assert any(r['type'] == kind and r['frames'] == 180 for r in rows)
        assert any(r['type'] == kind and r['viewport'] == [390, 844] for r in rows)
    assert sha('docs/island-spaces-normal-save.json') == 'e750698e0f888933e089bf8b0e76ebd9890c36d9bd8fcc1b3f5188f80709439c'
    names = [f'{region}-{kind}' for region in ['coast', 'forest', 'highland', 'shoal'] for kind in ['boar', 'crab']]
    names += [f'{mode}-{kind}' for mode in ['motion', 'mobile'] for kind in ['boar', 'crab']]
    report = {
        'candidateVerified': True, 'candidateDelivered': False,
        'fullGoalComplete': False, 'milestoneM5Complete': False, 'physicalMotionQualityPassed': False,
        'changedRuntime': {p: sha(p) for p in changed}, 'unchangedRuntimeFiles': 49,
        'fullTests': 232, 'focusedTests': 22, 'correctedBaselineFailures': 2,
        'renderRows': len(rows), 'console': rendered['console'],
        'imagesReviewedSha256': {f'docs/creature-grounding-{name}.png': sha(f'docs/creature-grounding-{name}.png') for name in names},
        'evidenceSha256': {f'docs/creature-grounding-{name}': sha(f'docs/creature-grounding-{name}') for name in ['render.json', 'tests.txt', 'focused.txt', 'corrected-red.txt']},
        'scope': 'Both species: real terrain/WorldView at four declared locations, two 180-frame tick pursuits, two mobile-size stills. Flat-plane vertex tests cover three yaw angles. No ordinary-save writes, current-source GPU/endurance acceptance, real device or foot-locking claim.',
        'remaining': 'Whole-body tilt and lift only; no per-foot IK. Curved/steep terrain and gait retain visible contact/slide gaps; tilt capped at .65rad and lift at .6m. Procedural model style/night readability and full-source performance still pending. Prior d672997 delivery/endurance remain historical, not current candidate evidence.'
    }
    (ROOT / 'docs/creature-grounding-candidate.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ['imagesReviewedSha256', 'evidenceSha256']}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
