"""Audit current-cast bounded endurance evidence, without asserting final quality."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    package = read('dist/tidelands-m5-2026-10-21-authored-cast-r2.json')
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    for name, entry in package['files'].items():
        assert sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) == entry['sha256'], name
    life = read('docs/authored-lifecycle.json')
    assert not life['console']
    sample = life['sample']
    assert sample['complete'] and sample['stableAfterFirstPair']
    assert len(sample['samples']) == 12
    assert all(s['authored'] and s['sameActors'] and s['glError'] == 0 for s in sample['samples'])
    release = sample['release']
    assert release['idempotent'] and release['glError'] == 0
    assert release['after']['textures'] < release['before']['textures']
    assert release['after']['geometries'] < release['before']['geometries']
    envelope = read('docs/authored-endurance-desktop.json')
    s = envelope['sample']
    assert not envelope['console']
    assert s['complete'] and s['authored'] and all(v for _, v in s['roles'])
    assert s['targetMs'] == 600000 and 600000 <= s['activeMs'] < 601000
    assert s['frames'] >= 25000 and not s['hidden'] and s['movingFraction'] > .85
    assert len(s['stages']) == 5 and all(p['distance'] > 30 for p in s['stages'])
    assert s['hitCount'] > 0 and s['damageTaken'] > 0 and s['respawns'] == 0
    assert s['stepAttempts'] == s['stepsScheduled']
    assert s['spatialAttempts'] == s['spatialScheduled']
    assert s['settled']['voices'] == 0
    assert s['settled']['pannersCreated'] == s['settled']['pannersReleased']
    assert all(c['glError'] == 0 and c['audio']['voices'] <= 12 for c in s['checkpoints'])
    images = envelope['images']
    assert images
    for name in images:
        assert (ROOT / name).read_bytes().startswith(b'\xff\xd8\xff'), name
    paths = ['tests/authored-endurance.html', 'tests/authored-lifecycle.html',
             'tools/verify_authored_endurance.py', 'docs/authored-lifecycle.json',
             'docs/authored-endurance-desktop.json'] + images
    summary = {k: s[k] for k in ['activeMs', 'frames', 'movingFraction', 'distanceMeters',
                               'hitCount', 'damageTaken', 'respawns', 'p95Ms', 'maxMs',
                               'over50Ms', 'stepAttempts', 'stepsScheduled', 'spatialAttempts',
                               'spatialScheduled', 'pannersCreated', 'pannersReleased', 'settled']}
    summary['heapMiB'] = [round(c['heapBytes'] / 1048576, 2) if c['heapBytes'] else None for c in s['checkpoints']]
    report = dict(passed=True, runtimeFiles=len(package['files']), packageSha256=package['archiveSha256'],
                  lifecycleStableAfterFirstPair=True, lifecycleRelease=release, continuous=summary,
                  evidenceSha256={p: sha(p) for p in paths}, fullGoalComplete=False, milestoneM5Complete=False,
                  limits='600s declared five-stage teleports, sword/food/buildings/revived enemies; actual movement/tick/actors/render/native audio. Stage names describe initial placement, not geographic containment throughout each phase; actor can leave the region. Diagnostic panels reduce canvas. Not native input, ordinary whole campaign, physical phone, VRAM, listening, leak freedom or final motion/visual quality. Startup resource count changes retained.')
    (ROOT / 'docs/authored-endurance-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    verify()
