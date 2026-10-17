"""Bounded contact evidence; complete motion quality is deliberately a separate gate."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'docs/creature-footing-browser.json').read_text())
for name, expected in data['sourceSha256'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
assert data['console'] == []
script = [r for r in data['rows'] if r['path'] == 'script' and r['viewport'][0] != 390]
assert {(r['region'], r['type']) for r in script} == {(p, t) for p in ['coast', 'forest', 'highland', 'shoal'] for t in ['boar', 'crab']}
for row in data['rows']:
    assert row['frames'] == (360 if row['path'] == 'script' else 180) and not row['running']
    assert not row['hidden'] and row['glError'] == 0
    assert row['plantedSamples'] > 100 and row['swingSamples'] > 20
    assert row['maxSlide'] < .015 and row['maxGap'] < .02
    # The rendered terrain is coarser than the analytic animation surface.
    assert row['maxMeshGap'] < .05
    assert row['moved'] > 1
chase = [r for r in data['rows'] if r['path'] == 'chase']
assert {r['type'] for r in chase} == {'boar', 'crab'}
assert any(r['hits'] > 0 for r in chase)
assert {r['type'] for r in data['rows'] if r['viewport'][0] == 390} == {'boar', 'crab'}
log = (root / 'docs/creature-footing-full-tests.txt').read_text()
assert '# tests 247' in log and '# fail 0' in log
diagnostic = json.loads((root / 'docs/creature-motion-contact-candidate.json').read_text())
for row in diagnostic['rows']:
    assert row['plantedPairSamples'] > 500 and row['maxPlantedSlip'] < .015
    assert len(row['frames']) == 300
images = {}
for path in sorted((root / 'docs').glob('creature-footing-current-*.jpg')):
    raw = path.read_bytes()
    assert raw[:3] == b'\xff\xd8\xff' and len(raw) > 10000
    images[str(path.relative_to(root))] = hashlib.sha256(raw).hexdigest()
assert len(images) >= 12
report = dict(passed=True, boundedCreatureFootingAccepted=True, tests=247,
              sourceSha256=data['sourceSha256'], imageSha256=images,
              maxPlantedSlide=max(r['maxSlide'] for r in data['rows']),
              maxAnalyticGap=max(r['maxGap'] for r in data['rows']),
              maxRenderedMeshGap=max(r['maxMeshGap'] for r in data['rows']),
              rafP95Range=[min(r['raf']['p95'] for r in data['rows']), max(r['raf']['p95'] for r in data['rows'])],
              maxRafInterval=max(r['raf']['max'] for r in data['rows']),
              candidateDelivered=False, physicalWholeFootQualityAccepted=False, milestoneM5Complete=False, fullGoalComplete=False,
              limits=['Articulated endpoint support, not complete sole collision, biomechanics or whole-body naturalness.',
                      'Scripted paths ignore obstacles; only chase fixtures use production AI/collision/damage.',
                      'Forest inspection camera/vegetation partly obscures bodies; its image is diagnostic, not full forest visual acceptance.',
                      'Short controlled-browser motion, no continuous video, current-source long run, real device or ordinary campaign.'])
(root / 'docs/creature-footing-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['passed', 'boundedCreatureFootingAccepted', 'tests', 'maxRenderedMeshGap', 'maxRafInterval', 'fullGoalComplete']}))
