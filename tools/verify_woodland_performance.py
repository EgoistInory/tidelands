"""Verify current110 GPU, continuous scripted load, and explicit resource disposal."""
from pathlib import Path
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    frozen = read('docs/woodland-performance-runtime.json')
    package = read('dist/tidelands-m5-2026-10-26-regional-woodland.json')
    assert frozen['runtimeInputs'] == len(frozen['files']) == 110
    assert frozen['files'] == package['files'] and frozen['packageSha256'] == package['archiveSha256']
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    for name, row in frozen['files'].items():
        assert sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) == row['sha256'], name
    for name, digest in frozen['fixtures'].items():
        assert sha(name) == digest, name
    devices = {}
    phases = ['shore', 'forest-combat', 'highland', 'amber-swim', 'night-camp']
    for device, viewport, buffer in [('desktop', [1280, 720], [1920, 1080]), ('390', [390, 844], [390, 844])]:
        envelope = read(f'docs/woodland-performance-gpu-{device}.json')
        s = envelope['sample']
        assert envelope['console'] == [] and s['complete'] and s['supported']
        assert not s['hidden'] and s['disjointCount'] == 0
        assert s['viewport'] == s['canvasCssSize'] == viewport and s['canvasBuffer'] == buffer
        assert s['woodlandInstalled'] and s['woodlandPlacements'] == 1445
        assert s['authoredCastInstalled'] and s['productionTerrain'] and s['impactFeedbackEnabled']
        assert s['timerBits'] > 0 and all(s[key] == 'ready' for key in ['groundStatus', 'sandStatus', 'rockStatus'])
        assert [row['phase'] for row in s['rows']] == phases
        for row in s['rows']:
            assert row['glError'] == 0 and row['gpuMs']['samples'] == len(row['gpuRawMs']) == 60
            assert all(math.isfinite(value) and value > 0 for value in row['gpuRawMs'])
        assert s['rows'][1]['hits'] > 0
        devices[device] = dict(viewport=viewport, buffer=buffer,
                               gpuP95Ms=[r['gpuMs']['p95'] for r in s['rows']],
                               cpuP95Ms=[r['cpuFrameWorkMs']['p95'] for r in s['rows']],
                               rafP95Ms=[r['rafIntervalMs']['p95'] for r in s['rows']],
                               drawCalls=[r['drawCalls'] for r in s['rows']],
                               triangles=[r['triangles'] for r in s['rows']])
    envelope = read('docs/woodland-performance-endurance.json')
    s = envelope['sample']
    assert envelope['console'] == [] and s['complete'] and not s['hidden'] and s['authored']
    assert s['woodlandInstalled'] and s['woodlandPlacements'] == 1445
    assert all(authored for _, authored in s['roles'])
    assert s['targetMs'] == 600000 and 600000 <= s['activeMs'] < 601000
    assert len(s['stages']) == 5 and all(row['distance'] > 0 for row in s['stages'])
    assert s['hitCount'] > 0 and s['damageTaken'] > 0 and s['campSpatialOptionsPassed']
    assert s['campFirePeak'] > 0 and s['campActiveFrames'] > 0
    assert s['settled']['voices'] == 0 and s['settled']['pannersCreated'] == s['settled']['pannersReleased']
    assert len(s['checkpoints']) >= 11
    for c in s['checkpoints']:
        assert c['glError'] == 0 and c['viewport'] == c['canvasCssSize'] == [1280, 720]
        assert c['canvasBuffer'] == [1920, 1080]
    life = read('docs/woodland-performance-lifecycle.json')
    sample = life['sample']
    assert life['console'] == [] and sample['complete'] and sample['stableAfterFirstPair']
    assert len(sample['samples']) == 12
    for row in sample['samples']:
        assert row['authored'] and row['sameActors'] and row['glError'] == 0
        assert row['woodlandInstalled'] and row['woodlandPlacements'] == 1445
    for key in ['release', 'woodlandRelease']:
        release = sample[key]
        assert release['idempotent'] and release['glError'] == 0
        assert all(release['after'][kind] < release['before'][kind] for kind in ['geometries', 'textures'])
    assert sha('docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images = ['docs/woodland-performance-gpu-desktop.jpg', 'docs/woodland-performance-gpu-390.jpg'] + envelope['images']
    assert len(images) == 4
    for name in images:
        assert (ROOT / name).read_bytes().startswith(b'\xff\xd8\xff'), name
    evidence = [f'docs/woodland-performance-{suffix}.json' for suffix in
                ['runtime', 'fixture-source', 'gpu-desktop', 'gpu-390', 'endurance', 'lifecycle']]
    report = dict(verified=True, frozenRuntimeInputs=110, runtimeCommit=frozen['runtimeCommit'],
                  packageSha256=package['archiveSha256'], productionFilesChanged=False,
                  nativeGpuSamples=600, fullCanvasGpuEvidenceRecorded=True, devices=devices,
                  boundedEnduranceRecorded=True,
                  continuous={key: s[key] for key in ['activeMs', 'frames', 'movingFraction', 'distanceMeters',
                                                     'hitCount', 'damageTaken', 'respawns', 'p95Ms', 'maxMs',
                                                     'over50Ms', 'campFirePeak', 'campActiveFrames', 'settled']},
                  heapBytes=[c['heapBytes'] for c in s['checkpoints']],
                  lifecycleRecorded=True, castRelease=sample['release'], woodlandRelease=sample['woodlandRelease'],
                  imagesViewed=4, systemGpuLoadIsolated=False, campSpatialAudioStimulatedByEndurance=True,
                  fullMainAudioEventMappingCovered=False, ordinaryCampaignReplayed=False,
                  physicalMobileVerified=False, audioListening=False, vramMeasured=False,
                  finalPerformanceAccepted=False, milestoneM5Complete=False, fullGoalComplete=False,
                  evidenceSha256={name: sha(name) for name in evidence + images},
                  scope='Native timer queries around production render; five teleported load fixtures, scripted 600s with actual movement/tick/actors/woodland/impacts and spatial camp audio inputs. Resource counts and JS heap are not VRAM/leak-freedom proof. No ordinary campaign, real device, listening or stable60fps acceptance; other paused views/system GPU load not isolated.')
    (ROOT / 'docs/woodland-performance-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    verify()
