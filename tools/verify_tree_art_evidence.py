"""Replay the bounded tree silhouette evidence, without asserting final quality."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-12-trees'


def read(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def verify():
    review = read('docs/tree-art-review.json')
    for path, expected in review['validationSourceSha256'].items():
        assert sha(path) == expected, path
    build = read(f'dist/{NAME}.json')
    old = read('dist/tidelands-m5-2026-10-12-character.json')
    check = read(f'docs/{NAME}-verification.json')
    assert check['passed'] and check['checkedFiles'] == 44 and check['archiveEntries'] == 45
    assert not build['fullGoalComplete'] and sha('dist/' + build['archive']) == build['archiveSha256'] == check['archiveSha256']
    assert len(build['files']) == 44 and build['archiveEntries'] == 45
    assert set(build['files']) - set(old['files']) == {'src/tree.js'}
    assert {p for p in old['files'] if build['files'][p] != old['files'][p]} == {'src/scene.js', 'src/foliage.js', 'README.md'}
    with zipfile.ZipFile(ROOT / 'dist' / build['archive']) as archive:
        assert archive.testzip() is None and len(archive.namelist()) == 45
        for p, entry in build['files'].items():
            data = archive.read('tidelands-local/' + p)
            assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256'], p
            assert sha('docs/LOCAL-DELIVERY.md' if p == 'README.md' else p) == entry['sha256'], p
    assert len(review['historicalArchives']) == 30
    for p, expected in review['historicalArchives'].items():
        assert sha('dist/' + p) == expected, p
    for p, count in [('tree-art-full-tests.txt', 181), ('tree-art-focused-tests.txt', 20)]:
        log = (ROOT / 'docs' / p).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert 'ERR_MODULE_NOT_FOUND' in (ROOT / 'docs/tree-art-red-tests.txt').read_text()
    log = (ROOT / 'docs/tree-art-package-tests.txt').read_text()
    assert 'Ran 4 tests' in log and '\nOK\n' in log
    numerical = read('docs/tree-art-numerical.json')
    assert numerical['passed'] and not numerical['fullGoalComplete']
    assert numerical['resourceNodesAndTreeInstanceTransformsUnchanged'] and numerical['berryGeometryAndSharedTexturesUnchanged']
    assert len(numerical['before']) == len(numerical['after']) == 2
    before = {b['kind']: b for b in numerical['before']}
    after = {b['kind']: b for b in numerical['after']}
    assert before['wood']['triangles'] == 156 and after['wood']['triangles'] == 1392
    assert before['leaves'] == after['leaves'] and after['leaves']['instances'] == 181
    for p, expected in numerical['sourceSha256'].items():
        assert sha(p) == expected, p
    model = read('docs/tree-art-model-ui.json')
    world = read('docs/tree-art-world-ui.json')
    assert not model['console'] and not world['console']
    assert len(model['samples']) == len(world['samples']) == 6
    assert all(s['glError'] == 0 and s['treeParts'] == 2 and s['treeTriangles'] == 2736 for s in model['samples'])
    assert any(not s['leaves'] for s in model['samples'])
    assert model['samples'][-1]['viewport'] == world['samples'][-1]['windowViewport'] == [390, 844]
    assert all(s['glError'] == 0 and s['surfaceStatus'] == s['rockStatus'] == 'ready' for s in world['samples'])
    assert any(s['time'] == 0 for s in world['samples'])
    baseline = read('docs/tree-art-baseline-world.json')
    for place in ['forest', 'spawn']:
        a = baseline[place]
        b = next(s for s in world['samples'] if s['place'] == place and s['time'] == 240)
        assert a['calls'] == b['calls'] and b['triangles'] - a['triangles'] == 1236 * 181
    dynamic = []
    for device, viewport in [('desktop', [1280, 720]), ('mobile', [390, 844])]:
        evidence = read(f'docs/tree-art-{device}-dynamic.json')
        r = evidence['result']
        assert not evidence['console'] and r['complete'] and r['activeMs'] >= 60000 and not r['hidden']
        assert r['targetMs'] == 60000 and r['movingFraction'] > .8 and len(r['stages']) == 5
        assert r['hitCount'] > 0 and r['stepsScheduled'] > 0 and all(p['viewport'] == viewport for p in r['checkpoints'])
        dynamic.append({'device': device, **{k: r[k] for k in ['activeMs', 'frames', 'p95Ms', 'maxMs', 'over50Ms']}})
    ordinary = read('docs/tree-art-package-ui.json')
    assert ordinary['normalFreshGame'] and not ordinary['importedFixture'] and not ordinary['runtimeStateEdited']
    assert not ordinary['console'] and ordinary['freshLabel'] == '开始旅程' and ordinary['resumedLabel'] == '继续旅程'
    assert ordinary['desktop']['coordinates'] == ordinary['mobile']['coordinates']
    for device in ['desktop', 'mobile']:
        s = ordinary[device]
        assert s['hp'] == '100' and s['quest'] == '归航的灯火'
        inv = {i['name']: int(i['count']) for i in s['inventory']}
        assert inv['木材'] == 2 and inv['浆果'] == 3 and sum(inv.values()) == 5
    assert ordinary['mobile']['width'] == ordinary['mobile']['scrollWidth'] == 390
    for p, expected in review['imagesViewedSha256'].items():
        assert sha(p) == expected, p
    result = {'kind': 'bounded-tree-art-evidence-audit', 'passed': True,
              'fullGoalComplete': False, 'milestoneM5Complete': False, 'pendingBatchEvidence': [],
              'changedProduction': ['src/tree.js', 'src/foliage.js', 'src/scene.js'],
              'archive': {k: build[k] for k in ['archive', 'archiveBytes', 'archiveEntries', 'archiveSha256']},
              'historicalArchivesPreserved': 30, 'geometryBudget': {k: numerical[k] for k in ['before', 'after', 'modelBounds']},
              'dynamicSamples': dynamic, 'ordinaryFinal': ordinary['mobile'], 'limits': review['remainingQuality'],
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p.relative_to(ROOT)) for p in sorted((ROOT / 'docs').glob('tree-art-*')) if p.name != 'tree-art-final-audit.json'}}
    (ROOT / 'docs/tree-art-final-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['passed', 'archive', 'historicalArchivesPreserved', 'dynamicSamples', 'fullGoalComplete']}, ensure_ascii=False))
    return result


if __name__ == '__main__':
    verify()
