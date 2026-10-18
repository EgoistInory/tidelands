"""Bind the bounded environment candidate to its geometry and browser evidence."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def load(path):
    return json.loads((ROOT / path).read_text())


def verify():
    baseline = load('docs/environment-mass-baseline.json')
    current = load('docs/environment-mass-candidate.json')
    changed = {path for path, digest in current['sources'].items() if digest != baseline['sources'][path]}
    assert changed == {'src/rock.js', 'src/rock-surface.js', 'src/foliage.js'}
    for path, digest in current['sources'].items():
        assert sha(path) == digest, path + ' changed after the probe'
        old = subprocess.check_output(['git', 'show', 'cdb4e93da4f710ed16c073af99272ccb767733fc:' + path], cwd=ROOT)
        assert hashlib.sha256(old).hexdigest() == baseline['sources'][path]
    assert baseline['worldSha256'] == current['worldSha256']
    for form, tree in current['trees'].items():
        before = baseline['trees'][form]
        for key in ['triangles', 'bytes', 'leafVertices', 'bounds']:
            assert tree[key] == before[key], (form, key)
        assert tree['upperValue'] - tree['lowerValue'] > .10
    assert current['rock']['triangles'] == baseline['rock']['triangles'] == 320
    assert current['rock']['upperFaceSamples'] >= 12
    assert current['rock']['upperFaceHeightRange'] < .002
    assert baseline['rock']['upperFaceHeightRange'] > .002
    before_ui = load('docs/whole-art-baseline-browser.json')
    ui = load('docs/environment-mass-browser.json')
    assert not before_ui['console'] and not ui['console']
    assert len(before_ui['rows']) == 8 and len(ui['rows']) == 10
    pairs = list(zip(before_ui['rows'][:7], ui['rows'][:7])) + [(before_ui['rows'][7], ui['rows'][8])]
    for before, row in pairs:
        for key in ['scene', 'startTime', 'frames', 'position', 'height', 'viewport', 'buffer', 'camera', 'render']:
            assert row[key] == before[key], (row['scene'], key)
    motion = [row for row in ui['rows'] if row['frames'] == 180]
    assert len(motion) == 3
    for row in ui['rows']:
        assert row['ready'] and not row['running'] and not row['hidden'] and row['glError'] == 0
    for row in motion:
        assert row['distance'] > 15 and len(row['poses']) == 6 and row['raf']['samples'] == 179
    for log, count in [('environment-mass-focused-tests.txt', 22), ('environment-mass-full-tests.txt', 249)]:
        text = (ROOT / 'docs' / log).read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    images = sorted(ROOT.glob('docs/whole-art-baseline-*.jpg')) + sorted(ROOT.glob('docs/environment-mass-current-*.jpg'))
    assert len(images) == 18
    for path in images:
        assert path.read_bytes()[:2] == b'\xff\xd8'
    assert sha('dist/tidelands-m5-2026-10-18-beacon-footing.zip') == '2d922da8581be03234e0b721cf7f5561b8d0612a5093ac55f82b5330b33ae5ca'
    assert sha('docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    report = {
        'verified': True, 'boundedEnvironmentSurfaceVerified': True,
        'wholeArtDirectionAccepted': False, 'fullM5Complete': False, 'fullGoalComplete': False,
        'candidateDelivered': False, 'currentSourceGpuOrLongRunAccepted': False,
        'changedRuntimeInputs': sorted(changed), 'sources': current['sources'],
        'evidenceSha256': {str(path.relative_to(ROOT)): sha(path.relative_to(ROOT)) for path in images},
        'sameConditionPairs': len(pairs), 'motion': motion,
        'tests': {'focused': 22, 'full': 249},
        'scope': 'Same production follow camera, state, draw counts and CPU geometry budget. Four biome noon stills, camp day/night, bounded 180-frame motion. No terrain/actor redesign, complete art quality, audition, physical phone, current-source GPU/endurance or new package delivery claim.',
    }
    for path in ['tests/whole-world-art-review.html', 'tests/environment-mass.test.js', 'tools/probe_environment_mass.mjs', 'docs/whole-art-baseline-browser.json', 'docs/environment-mass-browser.json', 'docs/environment-mass-baseline.json', 'docs/environment-mass-candidate.json']:
        report['evidenceSha256'][path] = sha(path)
    (ROOT / 'docs/environment-mass-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('environment mass candidate verified; complete art/M5/3A and new delivery remain false')


if __name__ == '__main__':
    verify()
