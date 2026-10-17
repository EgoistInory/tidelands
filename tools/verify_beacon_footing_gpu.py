import hashlib
import json
import math
from pathlib import Path

root = Path(__file__).resolve().parents[1]
frozen = json.loads((root / 'docs/beacon-footing-frozen-inputs.json').read_text())
for name, entry in frozen['files'].items():
    path = root / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)
    assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256'], name
assert hashlib.sha256((root / 'dist' / frozen['archive']).read_bytes()).hexdigest() == frozen['archiveSha256']
assert json.loads((root / 'docs/beacon-footing-gpu-console.json').read_text()) == []
summaries = {}
for device, size in [('desktop', [1920, 1080]), ('mobile', [390, 844])]:
    data = json.loads((root / f'docs/beacon-footing-gpu-{device}.json').read_text())
    assert data['complete'] and data['supported'] and not data['hidden'] and data['disjointCount'] == 0
    assert data['viewport'] == data['canvasBuffer'] == data['canvasCssSize'] == size
    assert len(data['rows']) == 5
    for row in data['rows']:
        assert row['gpuMs']['samples'] == len(row['gpuRawMs']) == 60
        assert all(math.isfinite(n) and n > 0 for n in row['gpuRawMs'])
        assert row['gpuMs']['p95'] < 16.67
    summaries[device] = {'gpuP95Range': [min(r['gpuMs']['p95'] for r in data['rows']), max(r['gpuMs']['p95'] for r in data['rows'])], 'viewport': size}
report = dict(passed=True, currentSourceFullCanvasGpuAccepted=True, archiveSha256=frozen['archiveSha256'],
              runtimeInputs=len(frozen['files']), devices=summaries, currentSourceLongRunAccepted=False,
              candidateDelivered=False, realDeviceVerified=False, fullGoalComplete=False,
              scope='Five teleported movement/combat/camp fixtures, 40 warmup and 60 native GPU queries each; no ordinary campaign, VRAM, real phone or full quality acceptance.')
(root / 'docs/beacon-footing-gpu-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False))
