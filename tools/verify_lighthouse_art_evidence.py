"""Replay a bounded landmark batch; this does not certify M5 or the full goal."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-12-lighthouse'


def read(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def verify():
    review = read('docs/lighthouse-art-review.json')
    for path, expected in review['validationSourceSha256'].items():
        assert sha(path) == expected, path
    build = read(f'dist/{NAME}.json')
    old = read('dist/tidelands-m5-2026-10-12-trees.json')
    check = read(f'docs/{NAME}-verification.json')
    assert check['passed'] and check['checkedFiles'] == 45 and check['archiveEntries'] == 46
    assert not build['fullGoalComplete'] and sha('dist/' + build['archive']) == build['archiveSha256'] == check['archiveSha256']
    assert len(build['files']) == 45 and build['archiveEntries'] == 46
    assert set(build['files']) - set(old['files']) == {'src/lighthouse.js'}
    assert {p for p in old['files'] if build['files'][p] != old['files'][p]} == {'src/scene.js', 'README.md'}
    with zipfile.ZipFile(ROOT / 'dist' / build['archive']) as archive:
        assert archive.testzip() is None and len(archive.namelist()) == 46
        for p, entry in build['files'].items():
            data = archive.read('tidelands-local/' + p)
            assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], p
            assert sha('docs/LOCAL-DELIVERY.md' if p == 'README.md' else p) == entry['sha256'], p
    assert len(review['historicalArchives']) == 31
    for p, expected in review['historicalArchives'].items():
        assert sha('dist/' + p) == expected, p
    for p, count in [('lighthouse-art-full-tests.txt', 183), ('lighthouse-art-focused-tests.txt', 17)]:
        log = (ROOT / 'docs' / p).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert 'ERR_MODULE_NOT_FOUND' in (ROOT / 'docs/lighthouse-art-red-tests.txt').read_text()
    log = (ROOT / 'docs/lighthouse-art-package-tests.txt').read_text()
    assert 'Ran 4 tests' in log and '\nOK\n' in log
    assert all(s['exitCode'] == 0 for s in read('docs/lighthouse-art-syntax.json')['checks'])
    numerical = read('docs/lighthouse-art-numerical.json')
    assert numerical['passed'] and numerical['baselineRuntimeInputsVerified'] == 44 and not numerical['fullGoalComplete']
    for key in ['worldAndResourceGeometryTransformsUnchanged', 'beaconParametersAndUpdateUnchanged', 'cameraEnvelopeUnchanged', 'cottageMapsReused']:
        assert numerical[key], key
    assert numerical['before']['triangles'] == 232 and numerical['after']['triangles'] == 8656
    assert numerical['before']['meshes'] == numerical['after']['meshes'] == 9
    for p, expected in numerical['sourceSha256'].items():
        assert sha(p) == expected, p
    baseline = read('docs/lighthouse-art-baseline-ui.json')
    ui = read('docs/lighthouse-art-ui.json')
    assert len(baseline['samples']) == 4 and len(ui['samples']) == 8
    assert not baseline['console'] and not ui['console']
    for s in ui['samples']:
        assert s['glError'] == 0 and s['ready'] and s['modelMeshes'] == 9 and s['modelTriangles'] == 8656
        assert s['beaconVisible'] == (s['quest'] == 6)
        assert s['lanternEmissive'] == (0xffce72 if s['quest'] == 6 else 0)
        assert s['lanternIntensity'] == (2 if s['quest'] == 6 else 0)
        assert s['beaconYaw'] == s['time'] * .3
    assert all(s['viewport'] == [390, 844] for s in ui['samples'][-2:])
    before, after = baseline['samples'][0], ui['samples'][0]
    assert before['modelTriangles'] == 232 and after['render']['calls'] - before['render']['calls'] == 1
    assert after['render']['triangles'] - before['render']['triangles'] == 8488
    assert (before['render']['textures'], after['render']['textures']) == (16, 19)
    dynamic = []
    for device, viewport in [('desktop', [1280, 720]), ('mobile', [390, 844])]:
        evidence = read(f'docs/lighthouse-art-{device}-dynamic.json')
        r = evidence['result']
        assert not evidence['console'] and r['complete'] and r['activeMs'] >= 60000 and not r['hidden']
        assert r['targetMs'] == 60000 and r['movingFraction'] > .8 and len(r['stages']) == 5
        assert r['hitCount'] > 0 and r['stepsScheduled'] > 0 and all(p['viewport'] == viewport for p in r['checkpoints'])
        dynamic.append({'device': device, **{k: r[k] for k in ['activeMs', 'frames', 'p95Ms', 'maxMs', 'over50Ms']}})
    ordinary = read('docs/lighthouse-art-package-ui.json')
    assert ordinary['normalFreshGame'] and not ordinary['importedFixture'] and not ordinary['runtimeStateEdited']
    assert not ordinary['console'] and ordinary['freshLabel'] == '开始旅程' and ordinary['resumedLabel'] == '继续旅程'
    assert ordinary['desktop']['coordinates'] == ordinary['mobile']['coordinates']
    for device in ['desktop', 'mobile']:
        s = ordinary[device]
        assert s['hp'] == '100' and s['quest'] == '归航的灯火'
        inv = {i['name']: int(i['count']) for i in s['inventory']}
        assert inv['木材'] == 2 and inv['浆果'] == 3 and sum(inv.values()) == 5
    assert ordinary['mobile']['width'] == ordinary['mobile']['scrollWidth'] == 390
    assert len(review['imagesViewedSha256']) == 16
    for p, expected in review['imagesViewedSha256'].items():
        assert sha(p) == expected, p
    result = {'kind': 'bounded-lighthouse-art-evidence-audit', 'passed': True,
              'fullGoalComplete': False, 'milestoneM5Complete': False, 'pendingBatchEvidence': [],
              'changedProduction': ['src/lighthouse.js', 'src/scene.js'],
              'archive': {k: build[k] for k in ['archive', 'archiveBytes', 'archiveEntries', 'archiveSha256']},
              'historicalArchivesPreserved': 31, 'geometryBudget': {k: numerical[k] for k in ['before', 'after']},
              'dynamicSamples': dynamic, 'ordinaryFinal': ordinary['mobile'], 'limits': review['remainingQuality'],
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p.relative_to(ROOT)) for p in sorted((ROOT / 'docs').glob('lighthouse-art-*')) if p.name != 'lighthouse-art-final-audit.json'}}
    (ROOT / 'docs/lighthouse-art-final-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['passed', 'archive', 'historicalArchivesPreserved', 'dynamicSamples', 'fullGoalComplete']}, ensure_ascii=False))
    return result


if __name__ == '__main__':
    verify()
