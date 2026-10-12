"""Replay this bounded character batch's saved evidence; not a final quality gate."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-12-character'
BASELINE = 'tidelands-m5-2026-10-12-buildlimit'


def read(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def verify():
    review = read('docs/character-adult-review.json')
    for path, expected in review['validationSourceSha256'].items():
        assert sha(path) == expected, path
    build = read(f'dist/{NAME}.json')
    old = read(f'dist/{BASELINE}.json')
    check = read(f'docs/{NAME}-verification.json')
    assert check['passed'] and check['checkedFiles'] == 43 and check['archiveEntries'] == 44
    assert not build['fullGoalComplete'] and check['archiveSha256'] == build['archiveSha256']
    assert sha('dist/' + build['archive']) == build['archiveSha256']
    assert len(build['files']) == 43 and build['archiveEntries'] == 44
    added = set(build['files']) - set(old['files'])
    changed = {p for p in old['files'] if build['files'][p] != old['files'][p]}
    assert added == {'src/character-head.js'} and changed == {'src/character.js', 'README.md'}
    with zipfile.ZipFile(ROOT / 'dist' / build['archive']) as archive:
        assert archive.testzip() is None and len(archive.namelist()) == 44
        for path, entry in build['files'].items():
            data = archive.read('tidelands-local/' + path)
            assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], path
            assert sha('docs/LOCAL-DELIVERY.md' if path == 'README.md' else path) == entry['sha256'], path
    assert len(review['historicalArchives']) == 29
    for path, expected in review['historicalArchives'].items():
        assert sha('dist/' + path) == expected, path
    for path, count in [('docs/character-adult-final-full-tests.txt', 179),
                        ('docs/character-adult-final-focused-tests.txt', 31)]:
        log = (ROOT / path).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert '# fail 2\n' in (ROOT / 'docs/character-adult-red-tests.txt').read_text()
    assert '# fail 1\n' in (ROOT / 'docs/character-adult-crown-red-tests.txt').read_text()
    package_tests = (ROOT / 'docs/character-adult-package-tests.txt').read_text()
    assert 'Ran 4 tests' in package_tests and '\nOK\n' in package_tests
    numerical = read('docs/character-adult-numerical.json')
    assert numerical['passed'] and not numerical['fullGoalComplete']
    assert numerical['sharedTextureCount'] == 2 and 6 <= numerical['headHeightsPerVisibleHeight'] <= 6.5
    assert all(m['poses'] == 279 and m['boneToolBootTransformsAndGeometryUnchanged'] for m in numerical['models'])
    assert numerical['after']['triangles'] == 15401 and numerical['before']['triangles'] == 5808
    for path, expected in numerical['sourceSha256'].items():
        assert sha(path) == expected, path
    model = read('docs/character-adult-views.json')
    world = read('docs/character-adult-world-ui.json')
    assert not model['console'] and not world['console']
    assert len(model['samples']) == len(world['samples']) == 6
    assert all(s['glError'] == 0 and s['visibleCharacterMeshes'] == 55 for s in model['samples'])
    assert model['samples'][-1]['windowViewport'] == world['samples'][-1]['viewport'] == [390, 844]
    assert all(s['glError'] == 0 and s['ready'] for s in world['samples'])
    assert {'idle', 'attack', 'gather'} <= {s['gesture'] for s in world['samples']}
    assert any(s['subject'] == 'camp' and s['time'] == 0 for s in world['samples'])
    dynamic = []
    for device, viewport in [('desktop', [1280, 720]), ('mobile', [390, 844])]:
        evidence = read(f'docs/character-adult-{device}-dynamic.json')
        r = evidence['result']
        assert not evidence['console'] and r['complete'] and r['targetMs'] == 60000
        assert r['activeMs'] >= 60000 and not r['hidden'] and r['movingFraction'] > .8
        assert len(r['stages']) == 5 and r['hitCount'] > 0 and r['stepsScheduled'] > 0
        assert all(p['viewport'] == viewport for p in r['checkpoints'])
        dynamic.append({'device': device, **{k: r[k] for k in ['activeMs', 'frames', 'p95Ms', 'maxMs', 'over50Ms']}})
    for gesture, equipment in [('attack', 'sword'), ('gather', 'axe')]:
        evidence = read(f'docs/character-adult-{gesture}-cycle.json')
        r = evidence['result']
        assert not evidence['console'] and r['complete'] and r['elapsedSeconds'] == 12
        assert r['gesture'] == gesture + '-cycle' and r['equipment'] == equipment
        assert r['stats']['actionFrames'] > 500 and r['stats']['maxSoleHeightError'] < 1e-5
    ordinary = read('docs/character-adult-package-ui.json')
    assert ordinary['normalFreshGame'] and not ordinary['importedFixture'] and not ordinary['runtimeStateEdited']
    assert not ordinary['console'] and ordinary['freshLabel'] == '开始旅程' and ordinary['resumedLabel'] == '继续旅程'
    assert ordinary['desktop']['coordinates'] == ordinary['mobile']['coordinates']
    for device in ['desktop', 'mobile']:
        s = ordinary[device]
        assert s['hp'] == '100' and s['quest'] == '归航的灯火'
        inv = {i['name']: int(i['count']) for i in s['inventory']}
        assert inv['木材'] == 2 and inv['浆果'] == 3 and sum(inv.values()) == 5
    assert ordinary['mobile']['width'] == ordinary['mobile']['scrollWidth'] == 390
    for path, expected in review['imagesViewedSha256'].items():
        assert sha(path) == expected, path
    result = {'kind': 'bounded-adult-character-evidence-audit', 'passed': True,
              'fullGoalComplete': False, 'milestoneM5Complete': False, 'pendingBatchEvidence': [],
              'changedProduction': ['src/character.js', 'src/character-head.js'],
              'archive': {k: build[k] for k in ['archive', 'archiveBytes', 'archiveEntries', 'archiveSha256']},
              'historicalArchivesPreserved': 29, 'geometryBudget': {k: numerical[k] for k in ['before', 'after', 'headHeightsPerVisibleHeight']},
              'dynamicSamples': dynamic, 'ordinaryFinal': ordinary['mobile'], 'limits': review['remainingQuality'],
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p.relative_to(ROOT)) for p in sorted((ROOT / 'docs').glob('character-adult-*')) if p.name != 'character-adult-final-audit.json'}}
    (ROOT / 'docs/character-adult-final-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['passed', 'archive', 'historicalArchivesPreserved', 'dynamicSamples', 'fullGoalComplete']}, ensure_ascii=False))
    return result


if __name__ == '__main__':
    verify()
