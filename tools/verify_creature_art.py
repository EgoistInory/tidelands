"""Audit the bounded creature delivery against retained runtime and browser evidence."""
from pathlib import Path
import hashlib
import json
import math
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-23-creature-surfaces'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads((ROOT / path).read_text())


def sources_match(sources):
    for path, digest in sources.items():
        assert sha(ROOT / path) == digest, path


def verify():
    package = load('dist/' + NAME + '.json')
    previous = load('dist/tidelands-m5-2026-10-23-night-fill.json')
    extraction = load('docs/' + NAME + '-verification.json')
    assert package['archiveBytes'] == 15062164 and package['archiveEntries'] == 95
    assert len(package['files']) == 94 and extraction['checkedFiles'] == 94 and extraction['passed']
    assert sha(ROOT / 'dist' / package['archive']) == package['archiveSha256'] == extraction['archiveSha256']
    assert (ROOT / 'dist' / package['archive']).stat().st_size == package['archiveBytes']
    assert package['builderSha256'] == previous['builderSha256'] == sha(ROOT / 'tools/package_local.py')
    changed = [p for p, row in package['files'].items()
               if row['sha256'] != previous['files'].get(p, {}).get('sha256')]
    assert changed == ['README.md', 'src/creature-surface.js', 'src/creature.js', 'src/scene.js']
    assert set(previous['files']) <= set(package['files'])
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as packed:
        assert len(packed.infolist()) == 95 and packed.testzip() is None
        for path, row in package['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if path == 'README.md' else path)
            assert sha(source) == row['sha256'], path
            assert sha(Path(extraction['extractedPath']) / path) == row['sha256'], path
            assert hashlib.sha256(packed.read('tidelands-local/' + path)).hexdigest() == row['sha256'], path
    assert sha(ROOT / 'dist' / previous['archive']) == previous['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / previous['archive']) as old:
        before = old.read('tidelands-local/src/scene.js').decode()
        assert before.replace('group.traverse(o=>{if(o.isMesh)',
                              'group.userData.releaseSurface?.();group.traverse(o=>{if(o.isMesh)') == (ROOT / 'src/scene.js').read_text()
        # Reset, gait, attack, hit/death and foot-support code form the unchanged tail.
        assert old.read('tidelands-local/src/creature.js').decode().split('export function resetCreature', 1)[1] == (ROOT / 'src/creature.js').read_text().split('export function resetCreature', 1)[1]
    models = load('docs/creature-art-browser.json')
    assert models['baselineConsole'] == models['candidateConsole'] == []
    assert len(models['rows']) == models['imagesViewed'] == 9
    rows = {r['name']: r for r in models['rows']}
    assert all(r['glError'] == 0 and not r['hidden'] for r in rows.values())
    for pose in ['pair', 'boar', 'crab-strike']:
        a, b = rows['baseline-' + pose], rows['candidate-' + pose]
        assert a['sourceSha256'] == previous['files']['src/creature.js']['sha256']
        assert b['sourceSha256'] == sha(ROOT / 'src/creature.js')
        assert b['surfaceSha256'] == sha(ROOT / 'src/creature-surface.js')
        for key in ['camera', 'pose', 'time', 'viewport', 'buffer']:
            assert a[key] == b[key], (pose, key)
        assert [m['feet'] for m in a['models']] == [m['feet'] for m in b['models']]
    assert [m['triangles'] for m in rows['candidate-pair']['models']] == [8224, 9896]
    assert rows['candidate-pair']['render']['textures'] == 7
    walk = rows['candidate-mobile-walk']
    assert walk['frames'] == 180 and not walk['running'] and walk['viewport'] == [390, 844]
    assert walk['buffer'] == [390, 667] and walk['raf']['samples'] == 179
    assert math.hypot(walk['models'][0]['position'][0] + 3, walk['models'][0]['position'][1]) > 8
    assert 'striped-rejected-pair' in rows and 'mobile-cropped-rejected' in rows
    main = load('docs/creature-art-main-browser.json')
    assert main['console'] == [] and len(main['rows']) == 2
    for row in main['rows']:
        sources_match(row['sources'])
        assert row['glError'] == 0 and row['targetTextured'] and row['paused']
    sword, hurt = main['rows']
    assert sword['targetHp'] == 2 and sword['hp'] == 100 and len(sword['events']) == 1
    assert [s['kind'] for s in sword['sounds']] == ['swing', 'hit']
    assert all(s['context'] == 'running' for s in sword['sounds'])
    assert hurt['hp'] == 88 and hurt['targetHp'] == 40 and hurt['events'] == []
    assert hurt['viewport'] == [390, 844] and hurt['hurtSource']['name'] == 'Hit_Chest'
    gpu = {}
    for label, size in [('desktop', [1920, 1080]), ('mobile', [390, 844])]:
        raw = load('docs/creature-art-gpu-' + label + '.json')
        r = raw['result']
        sources_match(r['sources'])
        assert raw['console'] == [] and r['complete'] and not r['hidden'] and not r['disjoint']
        assert r['glError'] == 0 and r['viewport'] == r['buffer'] == size and r['peak'] == 48
        assert [x['stage'] for x in r['rows']] == ['shore', 'forest', 'highland', 'shoal', 'night-camp']
        for sample in r['rows']:
            values = sample['gpuRawMs']
            assert len(values) == sample['gpuMs']['samples'] == 60 and all(v > 0 for v in values)
            assert sorted(values)[math.floor(len(values) * .95)] == sample['gpuMs']['p95']
            assert max(values) == sample['gpuMs']['max'] and sample['poolActive'] == 48
        gpu[label] = r
    assert 'release' not in gpu['desktop']  # Missing desktop click result is not cleanup proof.
    release = gpu['mobile']['release']
    assert release == {'before': {'geometries': 249, 'textures': 52},
                       'after': {'geometries': 204, 'textures': 46},
                       'active': 0, 'creatureCount': 0, 'geometryCacheSize': 0}
    ordinary = load('docs/creature-art-package-browser.json')
    assert ordinary['console'] == [] and '127.0.0.1:59851' in ordinary['ax']
    assert 'progress indicator Value: 79, ID: hp' in ordinary['ax']
    assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary['ax'] and '群岛，再次相连' in ordinary['ax']
    for item, count in [('木材', 4), ('石料', 5), ('纤维', 6), ('浆果', 3), ('贝壳', 0), ('晶石', 0), ('石斧', 1), ('晶石剑', 0), ('烤浆果', 0)]:
        assert re.search(r'text ' + item + r'\n\s+\d+ text ' + str(count) + r'\n', ordinary['bagAx'])
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    for label, count in [('focused', 30), ('full-tests', 304)]:
        log = (ROOT / ('docs/creature-art-' + label + '.txt')).read_text()
        assert '# tests ' + str(count) + '\n' in log and '# fail 0\n' in log
    assert '# fail 3\n' in (ROOT / 'docs/creature-art-red.txt').read_text()
    images = sorted((ROOT / 'docs').glob('creature-art-*.jpg'))
    assert len(images) == 14 and all(p.read_bytes()[:2] == b'\xff\xd8' for p in images)
    files = [*sorted((ROOT / 'docs').glob('creature-art-*.json')),
             *sorted((ROOT / 'docs').glob('creature-art-*.txt')), *images,
             *sorted((ROOT / 'tests').glob('creature-art*')),
             ROOT / 'tools/verify_creature_art.py', ROOT / 'docs/CREATURE-ART-DELIVERY.md',
             ROOT / ('docs/' + NAME + '-verification.json')]
    files = [p for p in files if p.name != 'creature-art-audit.json']
    report = dict(verified=True, boundedCreatureArtDelivered=True, archive=package['archive'],
                  archiveSha256=package['archiveSha256'], archiveBytes=package['archiveBytes'],
                  runtimeInputs=94, changedInputs=changed, extractedPath=extraction['extractedPath'],
                  fullTests=304, focusedTests=30, imagesViewed=14, rejectedImages=2,
                  currentExactSourceGpuAccepted=True, gpuRawSamples=600,
                  gpuP95Ms={k: [r['gpuMs']['p95'] for r in v['rows']] for k, v in gpu.items()},
                  gpuSystemLoadIsolated=False, mobileCreatureRelease=release, desktopReleaseCaptured=False,
                  ordinaryDesktopRestored=True, ordinary390ReloadRestored=False, ordinaryNewJsonExported=False,
                  currentExactSourceEnduranceAccepted=False, fullCreatureNaturalnessAccepted=False,
                  milestoneM5Complete=False, fullGoalComplete=False,
                  scope='Bounded form/surface delivery. Shared-browser GPU load was not isolated. Diagnostic desktop model buffers differ from viewport; valid mobile model canvas is 390x667. Production mobile hurt crops the boar. No full naturalness, physical device, audition, VRAM/leak freedom, new ordinary mobile save/export or full campaign acceptance.',
                  files={str(p.relative_to(ROOT)): sha(p) for p in files})
    (ROOT / 'docs/creature-art-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['verified', 'boundedCreatureArtDelivered', 'archiveSha256', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
