"""Audit current-ecosystem bounded continuous load, separately from full game quality."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    package = read('dist/tidelands-m5-2026-10-16-ecosystem.json')
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    for name, entry in package['files'].items():
        assert sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) == entry['sha256'], name
    summary = {}
    coverage_failures = []
    images = []
    for device, target, minimum_frames in [('desktop', 600000, 30000), ('mobile', 60000, 3000)]:
        data = read(f'docs/ecosystem-endurance-{device}.json')
        s = data['sample']
        assert data['harnessSha256'] == sha('tests/quality-endurance.html')
        assert not data['console'] and s['complete'] and not s['hidden']
        assert s['targetMs'] == target and target <= s['activeMs'] < target + 1000 and s['frames'] >= minimum_frames
        assert s['hitCount'] > 0 and s['damageTaken'] > 0
        if s['movingFraction'] <= .85:
            coverage_failures.append(f"{device}: moving fraction {s['movingFraction']} does not exceed0.85")
        if s['respawns'] != 0:
            coverage_failures.append(f"{device}: {s['respawns']} respawn interrupts the intended survival load")
        assert s['stepAttempts'] == s['stepsScheduled']
        assert len(s['stages']) == 5 and all(p['distance'] > 30 for p in s['stages'])
        assert all(c['glError'] == 0 and c['audio']['voices'] <= 12 for c in s['checkpoints'])
        assert all(c['heapBytes'] is not None and c['heapBytes'] > 0 for c in s['checkpoints'])
        summary[device] = {k: s[k] for k in ['activeMs', 'frames', 'movingFraction', 'distanceMeters', 'hitCount', 'damageTaken', 'medianMs', 'p95Ms', 'maxMs', 'over50Ms']}
        summary[device].update(heapMiB=[round(c['heapBytes'] / 1048576, 2) for c in s['checkpoints']], viewport=s['checkpoints'][-1]['viewport'], canvasBuffer=s['checkpoints'][-1]['canvasBuffer'], respawns=s['respawns'], phaseMovingFractions={p['name']: round(p['movingFrames'] / max(1, p['frames']), 4) for p in s['stages']})
        images += data['images']
    assert len(images) >= 6 and all((ROOT / p).stat().st_size > 1000 for p in images)
    # The prior finite GPU sample remains valid only while these exact runtime hashes match.
    gpu = read('docs/ecosystem-delivery-audit.json')
    assert gpu['archiveSha256'] == package['archiveSha256'] and not gpu['fullGoalComplete']
    assert set(gpu['gpuP95Ms']) == {'desktop', 'mobile'}
    rejected = read('docs/ecosystem-endurance-candidate1-audit.json')
    assert not rejected['boundedContinuousLoadAccepted'] and len(rejected['coverageFailures']) == 2
    assert all(sha(name) == digest for name, digest in rejected['evidenceSha256'].items())
    probe = read('docs/ecosystem-endurance-escape-probe.json')['rows']
    passive = next(r for r in probe if r['fps'] == 90 and not r['defensive'])
    defending = next(r for r in probe if r['fps'] == 90 and r['defensive'])
    assert passive['movingFraction'] < .2 and passive['respawns'] == 1
    assert defending['movingFraction'] > .9 and defending['respawns'] == 0 and defending['hits'] > 0
    paths = ['tests/quality-endurance.html', 'docs/ecosystem-endurance-desktop.json', 'docs/ecosystem-endurance-mobile.json', 'docs/ecosystem-gpu-desktop.json', 'docs/ecosystem-gpu-mobile.json', 'docs/ecosystem-endurance-candidate1-audit.json', 'docs/ecosystem-endurance-escape-probe.json'] + images
    report = {'boundedContinuousLoadAccepted': not coverage_failures, 'metricsCaptured': True, 'coverageFailures': coverage_failures, 'archive': package['archive'], 'archiveSha256': package['archiveSha256'], 'runtimeFilesMatched': len(package['files']), 'samples': summary, 'sourceSha256': {name: entry['sha256'] for name, entry in package['files'].items()}, 'evidenceSha256': {name: sha(name) for name in paths}, 'gpuP95Ms': gpu['gpuP95Ms'], 'ordinarySaveOperated': False, 'nativeInput': False, 'realMobileDevice': False, 'vramMeasured': False, 'audioListened': False, 'fullCurrentJourneyReplayed': False, 'm5Complete': False, 'fullGoalComplete': False, 'limits': '600s desktop and60s390 scripted five-phase teleports with weapon/food/camp/revived enemy fixtures. Render/audio/swept movement use production code. Diagnostic panel reduces canvas size. rAF includes host scheduling; natural GC snapshots are not leak freedom or VRAM. Separate GPU fixtures exclude audio/HUD. No ordinary campaign or final visual-quality acceptance.'}
    (ROOT / 'docs/ecosystem-endurance-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'accepted': report['boundedContinuousLoadAccepted'], 'coverageFailures': coverage_failures, 'samples': summary, 'fullGoalComplete': False}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    result = verify()
    raise SystemExit(0 if result['boundedContinuousLoadAccepted'] else 1)
