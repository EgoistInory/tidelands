"""Saved evidence for the early-save resume label correction; full goal remains open."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
NAME = 'tidelands-m5-2026-10-12-resume'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((DOCS / name).read_text())


def audit():
    review = read('early-resume-review.json')
    for name, expected in review['validationSourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    old = json.loads((ROOT / 'dist' / 'tidelands-m5-2026-10-12-crystal.json').read_text())
    changed = {n for n in old['files'] if n.startswith('src/') and sha(ROOT / n) != old['files'][n]['sha256']}
    assert changed == {'src/main.js'} and len(build['files']) == 41 and not build['fullGoalComplete']
    assert sha(ROOT / 'dist' / (NAME + '.zip')) == build['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / (NAME + '.zip')) as archive:
        assert len(archive.namelist()) == 42 and archive.testzip() is None
        for name, entry in build['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert sha(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == entry['sha256'], name
    assert len(review['historicalArchives']) == 25
    for name, expected in review['historicalArchives'].items():
        assert sha(ROOT / 'dist' / name) == expected, name
    log = (DOCS / 'early-resume-full-tests.txt').read_text()
    assert re.search(r'^# pass 166$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    red, green, corrupt = read('early-resume-red.json'), read('early-resume-green.json'), read('early-resume-corrupt.json')
    assert not red['passed'] and red['saved']['time'] < 121 and red['saved']['quest'] == 0
    assert red['labelAfterReload'] == '开始旅程' and green['label'] == '继续旅程'
    original, actual = green['originalSaved'], green['actualAfterContinue']
    assert original == red['saved'] and original['time'] <= actual['time'] < 121
    assert original['position'] == actual['position'] and original['inventory'] == actual['inventory']
    assert original['quest'] == actual['quest'] == 0 and not green['console']
    assert corrupt['label'] == '开始旅程' and '旧存档未能读取' in corrupt['message'] and not corrupt['console']
    package = read('early-resume-package-ui.json')
    assert not package['fixtureImported'] and not package['console']
    assert package['freshLabel'] == '开始旅程' and package['resumedLabel'] == '继续旅程'
    assert package['restored']['coordinates'] == '位置 X -70.0，Z 102.0；建筑 0；击败 0'
    assert package['restored']['hp'] == '100' and package['restored']['width'] == package['restored']['scrollWidth'] == 390
    for name, expected in review['imagesViewedSha256'].items():
        assert sha(ROOT / name) == expected, name
    evidence = [p for p in sorted(DOCS.glob('early-resume-*')) if p.name not in ('early-resume-review.json', 'early-resume-final-audit.json')]
    report = {'kind': 'bounded-resume-evidence-audit', 'passed': True, 'fullGoalComplete': False,
              'milestoneM5Complete': False, 'pendingBatchEvidence': [], 'changedProduction': ['src/main.js'],
              'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
              'runtimeSha256': {n: sha(ROOT / n) for n in build['files'] if n.startswith('src/')},
              'historicalArchivesPreserved': 25, 'savedTime': original['time'], 'restoredTime': actual['time'],
              'ordinaryFinal': package['restored'], 'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for p in evidence},
              'limits': review['remainingQuality']}
    (DOCS / 'early-resume-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('passed', 'fullGoalComplete', 'savedTime', 'restoredTime')}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    audit()
