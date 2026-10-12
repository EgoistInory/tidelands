"""Replay the saved bounded crystal batch; not a full 3A acceptance audit."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
NAME = 'tidelands-m5-2026-10-12-crystal'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((DOCS / name).read_text())


def audit():
    review = read('crystal-review.json')
    for name, expected in review['validationSourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    old = json.loads((ROOT / 'dist' / 'tidelands-m5-2026-10-12-harvest.json').read_text())
    changed = {n for n in old['files'] if n.startswith('src/') and sha(ROOT / n) != old['files'][n]['sha256']}
    assert changed == {'src/scene.js'}
    assert set(build['files']) - set(old['files']) == {'src/crystal.js'}
    assert len(build['files']) == 41 and not build['fullGoalComplete']
    assert sha(ROOT / 'dist' / (NAME + '.zip')) == build['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / (NAME + '.zip')) as archive:
        assert len(archive.namelist()) == 42 and archive.testzip() is None
        for name, entry in build['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert sha(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == entry['sha256'], name
    assert len(review['historicalArchives']) == 24
    for name, expected in review['historicalArchives'].items():
        assert sha(ROOT / 'dist' / name) == expected, name
    for kind, count in [('focused', 3), ('full', 166)]:
        log = (DOCS / ('crystal-' + kind + '-tests.txt')).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert 'ERR_MODULE_NOT_FOUND' in (DOCS / 'crystal-red-tests.txt').read_text()
    package_log = (DOCS / 'crystal-package-tests.txt').read_text()
    assert 'Ran 4 tests' in package_log and re.search(r'^OK$', package_log, re.M)
    numerical = read('crystal-numerical.json')
    assert len(numerical['parts']) == 2 and 60 < numerical['totalTriangles'] < 500
    assert max(abs(numerical['bounds'][which][axis]) for which in ('min', 'max') for axis in (0, 2)) <= 1.5
    assert numerical['bounds']['min'][1] <= 0 and numerical['bounds']['max'][1] <= 3.5
    for name, expected in numerical['sourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    ui = read('crystal-ui.json')
    assert not ui['console'] and len(ui['samples']) == 3
    before, after, mobile = ui['samples']
    assert all(s['glError'] == 0 and s['crystalParts'] == 2 for s in ui['samples'])
    assert before['nodeVisibleParts'] == 2 and before['inventory']['crystal'] == 0
    assert after['nodeVisibleParts'] == 0 and after['inventory']['crystal'] == 1
    assert mobile['viewport'] == [390, 844] and len(mobile['frames']) >= 30
    assert all(f['inventory']['crystal'] == 0 for f in mobile['frames'] if f['age'] < .21)
    assert mobile['frames'][-1]['nodeVisibleParts'] == 0 and mobile['frames'][-1]['inventory']['crystal'] == 1
    package = read('crystal-package-ui.json')
    assert package['freshOrigin'] and not package['fixtureImported'] and not package['console']
    assert package['savedCoordinates'] == package['restored']['coordinates']
    assert package['restored']['hp'] == '100' and package['restored']['width'] == package['restored']['scrollWidth'] == 390
    for name, expected in review['imagesViewedSha256'].items():
        assert sha(ROOT / name) == expected, name
    evidence = [p for p in sorted(DOCS.glob('crystal-*')) if p.name not in ('crystal-review.json', 'crystal-final-audit.json')]
    report = {'kind': 'bounded-crystal-evidence-audit', 'passed': True, 'fullGoalComplete': False,
              'milestoneM5Complete': False, 'pendingBatchEvidence': [], 'changedProduction': ['src/crystal.js', 'src/scene.js'],
              'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
              'runtimeSha256': {n: sha(ROOT / n) for n in build['files'] if n.startswith('src/')},
              'historicalArchivesPreserved': 24, 'ordinaryFinal': package['restored'],
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for p in evidence}, 'limits': review['remainingQuality']}
    (DOCS / 'crystal-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('passed', 'fullGoalComplete', 'historicalArchivesPreserved')}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    audit()
