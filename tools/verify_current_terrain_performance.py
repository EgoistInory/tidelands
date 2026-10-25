"""Check current frozen-runtime GPU and bounded endurance evidence separately."""
from pathlib import Path
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[1]
read = lambda name: json.loads((ROOT / name).read_text())
sha = lambda name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    frozen = read('dist/tidelands-m5-2026-10-25-terrain-composition.json')
    assert len(frozen['files']) == 95
    assert sha('dist/' + frozen['archive']) == frozen['archiveSha256']
    for name, item in frozen['files'].items():
        assert sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) == item['sha256'], name
    assert sha('docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    assert read('docs/current-terrain-gpu-console.json') == []
    partial = read('docs/current-terrain-gpu-partial-canvas-rejected.json')
    assert partial['canvasCssSize'] != partial['viewport']
    devices = {}
    for device, size, buffer in [('desktop', [1280, 720], [1920, 1080]), ('390', [390, 844], [390, 844])]:
        data = read('docs/current-terrain-gpu-' + device + '.json')
        assert data['complete'] and data['supported'] and not data['hidden'] and data['disjointCount'] == 0
        assert data['viewport'] == data['canvasCssSize'] == size and data['canvasBuffer'] == buffer
        assert data['authoredCastInstalled'] and data['productionTerrain'] and data['impactFeedbackEnabled']
        assert data['timerBits'] > 0 and all(data[name] == 'ready' for name in ['groundStatus', 'sandStatus', 'rockStatus'])
        assert [row['phase'] for row in data['rows']] == ['shore', 'forest-combat', 'highland', 'amber-swim', 'night-camp']
        for row in data['rows']:
            assert row['glError'] == 0
            assert row['gpuMs']['samples'] == len(row['gpuRawMs']) == 60
            assert all(math.isfinite(n) and n > 0 for n in row['gpuRawMs'])
        assert data['rows'][1]['hits'] > 0
        devices[device] = dict(viewport=size, buffer=buffer, gpuP95Ms=[r['gpuMs']['p95'] for r in data['rows']],
                               cpuP95Ms=[r['cpuFrameWorkMs']['p95'] for r in data['rows']],
                               rafP95Ms=[r['rafIntervalMs']['p95'] for r in data['rows']])
    report = dict(verified=True, frozenRuntimeInputs=95, packageSha256=frozen['archiveSha256'],
                  nativeGpuSamples=600, fullCanvasGpuEvidenceRecorded=True, devices=devices,
                  rejectedPartialCanvasPreserved=True, boundedEnduranceRecorded=False,
                  lifecycleRecorded=False, finalPerformanceAccepted=False, milestoneM5Complete=False,
                  fullGoalComplete=False, systemGpuLoadIsolated=False)
    endurance_path = ROOT / 'docs/current-terrain-endurance-desktop.json'
    if endurance_path.exists():
        envelope = read(str(endurance_path.relative_to(ROOT)))
        s = envelope['sample']
        assert not envelope['console'] and s['complete'] and not s['hidden'] and s['authored']
        assert all(authored for _, authored in s['roles'])
        assert s['targetMs'] == 600000 and 600000 <= s['activeMs'] < 601000
        assert len(s['stages']) == 5 and all(stage['distance'] > 0 for stage in s['stages'])
        assert s['hitCount'] > 0 and s['damageTaken'] > 0
        assert all(c['glError'] == 0 and c['canvasCssSize'] == c['viewport'] == [1280, 720]
                   and c['canvasBuffer'] == [1920, 1080] for c in s['checkpoints'])
        assert s['settled']['voices'] == 0 and s['settled']['pannersCreated'] == s['settled']['pannersReleased']
        report['boundedEnduranceRecorded'] = True
        report['continuous'] = {key: s[key] for key in ['activeMs', 'frames', 'movingFraction', 'distanceMeters',
                                                        'hitCount', 'damageTaken', 'respawns', 'p95Ms', 'maxMs', 'over50Ms', 'settled']}
        report['heapBytes'] = [c['heapBytes'] for c in s['checkpoints']]
    life_path = ROOT / 'docs/current-terrain-lifecycle.json'
    if life_path.exists():
        envelope = read(str(life_path.relative_to(ROOT)))
        sample = envelope['sample']
        assert not envelope['console'] and sample['complete'] and sample['stableAfterFirstPair']
        assert len(sample['samples']) == 12 and all(s['authored'] and s['sameActors'] and s['glError'] == 0 for s in sample['samples'])
        release = sample['release']
        assert release['idempotent'] and release['glError'] == 0
        assert all(release['after'][kind] < release['before'][kind] for kind in ['geometries', 'textures'])
        report['lifecycleRecorded'] = True
        report['lifecycleRelease'] = release
    evidence = ['tests/current-terrain-gpu.html', 'tests/current-terrain-endurance.html',
                'tests/authored-lifecycle.html', 'docs/current-terrain-gpu-desktop.json',
                'docs/current-terrain-gpu-390.json', 'docs/current-terrain-gpu-console.json',
                'docs/current-terrain-gpu-partial-canvas-rejected.json']
    for path in [endurance_path, life_path]:
        if path.exists():
            evidence.append(str(path.relative_to(ROOT)))
    images = ['docs/current-terrain-gpu-desktop.jpg', 'docs/current-terrain-gpu-390.jpg']
    if endurance_path.exists():
        images += read(str(endurance_path.relative_to(ROOT)))['images']
    for name in images:
        assert (ROOT / name).read_bytes().startswith(b'\xff\xd8\xff'), name
    report['evidenceSha256'] = {name: sha(name) for name in evidence + images}
    report['imagesViewed'] = len(images)
    report['campSpatialAudioStimulatedByEndurance'] = False
    report['scope'] = 'Frozen production modules; declared five-stage teleports/equipment/enemy/building fixtures, native GPU queries, optional scripted 600s and fixed-view lifecycle. Stage names are initial placements, not geographic containment. Endurance uses older synthetic audio calls without buildings/cameraYaw options, so camp spatial fire and full main event mapping are not covered. GPU scheduling/command submission interval is not pure shader busy time. rAF, JS heap, Three resource counts and voice settlement remain distinct; no ordinary campaign, listening, physical mobile, VRAM or leak-freedom proof. Other paused diagnostic views/system GPU load not isolated.'
    (ROOT / 'docs/current-terrain-performance-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    verify()
