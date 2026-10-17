"""Verify this bounded visual candidate, never the full quality goal."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'docs/beacon-soft-browser.json').read_text())
for name, expected in data['sourceSha256'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
assert data['console'] == []
assert {r['pose'] for r in data['poses']} == {'front', 'side', 'axis', 'inside'}
for row in [*data['poses'], data['day'], data['desktopMotion'], data['mobileMotion']]:
    assert row['glError'] == 0 and not row['hidden']
    assert row['ready']
probe = data['poses'][0]['probe']
current, old = probe['rgba'], probe['legacy']
assert old['center'][3] == old['edge'][3] == old['far'][3] > 0
assert 0 < current['edge'][3] < current['center'][3] < old['center'][3]
assert current['far'][3] == current['outside'][3] == 0
assert probe['insideCapRgba'][3] == 0
for name in ['desktopMotion', 'mobileMotion']:
    row = data[name]
    assert row['frames'] == 240 and not row['running'] and row['raf']['samples'] == 239
assert data['mobileMotion']['viewport'] == [390, 844]
assert '# tests 242' in (root / 'docs/beacon-soft-full-tests.txt').read_text()
assert '# fail 0' in (root / 'docs/beacon-soft-full-tests.txt').read_text()
images = ['baseline-front', 'final-front', 'current-front', 'current-side', 'current-axis', 'inside', 'day', 'mobile']
evidence = {}
for name in images:
    path = root / f'docs/beacon-soft-{name}.jpg'
    raw = path.read_bytes()
    assert raw[:3] == b'\xff\xd8\xff' and len(raw) > 10000
    evidence[str(path.relative_to(root))] = hashlib.sha256(raw).hexdigest()
report = dict(passed=True, boundedBeamSofteningAccepted=True, candidateDelivered=False,
              milestoneM5Complete=False, fullGoalComplete=False, sourceSha256=data['sourceSha256'],
              gpuAlphaProbe=probe, imageSha256=evidence, tests=242,
              desktopRaf=data['desktopMotion']['raf'], mobileRaf=data['mobileMotion']['raf'],
              limits=['Soft cone shell, not volumetric scattering; axial/interior beam can disappear.',
                      'Fixed quest6/inspection camera and 240-frame rotation fixtures; no ordinary campaign.',
                      'Pixel readback proves shader attenuation, not GPU frame time. No current-source long run, package or real phone.',
                      'The initial UV-cap disk artifact was observed and fixed by axial position attenuation; initial screenshot retained.'])
(root / 'docs/beacon-soft-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['passed', 'boundedBeamSofteningAccepted', 'tests', 'fullGoalComplete']}))
