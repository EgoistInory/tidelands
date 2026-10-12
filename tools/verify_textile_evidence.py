"""Audit saved evidence for the bounded clothing/shelter material batch."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-12-textile'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((ROOT / 'docs' / name).read_text())


def audit():
    review = read('textile-review.json')
    for name, expected in review['validationSourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    prior = json.loads((ROOT / 'dist' / 'tidelands-m5-2026-10-12-resume.json').read_text())
    changed = {n for n in prior['files'] if n.startswith('src/') and sha(ROOT / n) != prior['files'][n]['sha256']}
    assert changed == {'src/character.js', 'src/scene.js'}
    assert set(n for n in build['files'] if n.startswith('src/')) - set(n for n in prior['files'] if n.startswith('src/')) == {'src/textile.js'}
    assert len(build['files']) == 42 and build['archiveEntries'] == 43 and not build['fullGoalComplete']
    assert sha(ROOT / 'dist' / build['archive']) == build['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / build['archive']) as archive:
        assert archive.testzip() is None and len(archive.namelist()) == 43
        for name, entry in build['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert sha(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == entry['sha256'], name
    assert len(review['historicalArchives']) == 26
    for name, expected in review['historicalArchives'].items():
        assert sha(ROOT / 'dist' / name) == expected, name
    log = (ROOT / 'docs/textile-final-full-tests.txt').read_text()
    assert re.search(r'^# pass 169$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert 'ERR_MODULE_NOT_FOUND' in (ROOT / 'docs/textile-red-tests.txt').read_text()
    assert '0.94 !== 1' in (ROOT / 'docs/textile-initial-full-tests.txt').read_text()
    assert 'Ran 4 tests' in (ROOT / 'docs/textile-package-tests.txt').read_text()
    numerical = read('textile-numerical.json')
    assert numerical['passed'] and numerical['sharedTextureCount'] == 2 and numerical['rawTextureBytes'] == 131072
    assert all(m['geometryAndPoseUnchanged'] for m in numerical['models'])
    assert [m['poses'] for m in numerical['models'] if m['kind'] == 'character'] == [279, 279]
    for name, expected in numerical['sourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    ui = read('textile-ui.json')
    assert len(ui['samples']) == 8 and not ui['console'] and ui['fixture']
    assert all(s['ready'] and s['glError'] == 0 and s['textileMeshes'] == 73 for s in ui['samples'])
    assert all(s['textileMaps'] == (2 if s['enabled'] else 0) for s in ui['samples'])
    motions = []
    for name in ('textile-desktop-motion.json', 'textile-mobile-motion.json'):
        evidence = read(name)
        stats = evidence['stats']
        assert stats['complete'] and stats['elapsedMs'] >= 10000 and len(stats['frames']) > 500 and not stats['hidden']
        assert evidence['glError'] == 0 and len({tuple(f['position']) for f in stats['frames']}) > 500
        motions.append({'viewport': evidence['viewport'], **{k: stats[k] for k in ('elapsedMs', 'p95Ms', 'maxMs', 'over50ms')}, 'frames': len(stats['frames'])})
    package = read('textile-package-ui.json')
    assert not package['fixtureImported'] and not package['stateInjected'] and not package['console']
    assert package['freshLabel'] == '开始旅程' and package['resumedLabel'] == '继续旅程'
    final = package['restored']
    assert final['coordinates'] == '位置 X -73.0，Z 93.4；建筑 0；击败 0' and final['hp'] == '100'
    assert final['width'] == final['scrollWidth'] == 390 and final['quest'] == '归航的灯火'
    inventory = {i['name']: int(i['count']) for i in final['inventory']}
    assert inventory['木材'] == 2 and inventory['浆果'] == 3 and sum(inventory.values()) == 5
    for name, expected in review['imagesViewedSha256'].items():
        assert sha(ROOT / name) == expected, name
    report = {'kind': 'bounded-textile-evidence-audit', 'passed': True, 'fullGoalComplete': False,
              'milestoneM5Complete': False, 'pendingBatchEvidence': [], 'changedProduction': ['src/textile.js', *sorted(changed)],
              'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
              'runtimeSha256': {n: sha(ROOT / n) for n in build['files'] if n.startswith('src/')},
              'historicalArchivesPreserved': 26, 'motions': motions, 'ordinaryFinal': final,
              'limits': review['remainingQuality'],
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for p in sorted((ROOT / 'docs').glob('textile-*')) if p.name not in ('textile-review.json', 'textile-final-audit.json')}}
    (ROOT / 'docs/textile-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('passed', 'fullGoalComplete', 'historicalArchivesPreserved', 'motions')}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    audit()
