"""Check saved evidence for the close gathering batch, not full M5 quality."""
import hashlib
import json
import math
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
NAME = 'tidelands-m5-2026-10-12-gather'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((DOCS / name).read_text())


def inventory(step):
    return {item['name']: int(item['count']) for item in step['inventory']}


def audit():
    review = read('gather-contact-review.json')
    for name, expected in review['validationSourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    old = json.loads((ROOT / 'dist' / 'tidelands-m5-2026-10-12-attack.json').read_text())
    changed = {n for n in old['files'] if n.startswith('src/') and sha(ROOT / n) != old['files'][n]['sha256']}
    assert changed == {'src/action-timing.js', 'src/character.js', 'src/game.js'}, changed
    assert not build['fullGoalComplete'] and len(build['files']) == 40
    assert sha(ROOT / 'dist' / (NAME + '.zip')) == build['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / (NAME + '.zip')) as archive:
        assert len(archive.namelist()) == 41 and archive.testzip() is None
        for name, entry in build['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert sha(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == entry['sha256'], name
    assert len(review['historicalArchives']) == 22
    for name, expected in review['historicalArchives'].items():
        assert sha(ROOT / 'dist' / name) == expected, name
    for kind, count in [('focused', 55), ('full', 160)]:
        log = (DOCS / ('gather-contact-' + kind + '-tests.txt')).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert re.search(r'^# fail 4$', (DOCS / 'gather-contact-red-tests.txt').read_text(), re.M)
    package_log = (DOCS / 'gather-contact-package-tests.txt').read_text()
    assert 'Ran 4 tests' in package_log and re.search(r'^OK$', package_log, re.M)
    soak = read('gather-contact-soak.json')
    assert soak['passed'] and soak['reloads'] == 60 and soak['sourceHash'] == sha(ROOT / 'src/game.js')
    numerical = read('gather-contact-numerical.json')
    for name, expected in numerical['sourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    assert [len(s['hits']) for s in numerical['rules']] == [1, 0, 0, 0]
    assert [s['stone'] for s in numerical['gatherRules']] == [2, 0, 0]
    for sample in numerical['samples']:
        if sample['action'] == 'gather':
            assert sample['bladeBounds']['min'][1] > .12
            assert sample['bladeBounds']['max'][1] < 1.8
            assert sample['bladeBounds']['max'][2] > .8
    ui = read('gather-contact-ui.json')
    assert not ui['console'] and len(ui['samples']) == 10
    assert all(s['glError'] == 0 for s in ui['samples'])
    for before, after, item, count in [(0, 1, 'wood', 3), (3, 4, 'stone', 3), (8, 9, 'fiber', 2)]:
        assert ui['samples'][before]['age'] < .21 and ui['samples'][before]['inventory'][item] == 0
        assert ui['samples'][after]['inventory'][item] == count
    assert ui['samples'][2]['distance'] == 5 and ui['samples'][2]['nearestId'] is None
    assert ui['samples'][2]['inventory']['wood'] == 0 and ui['samples'][2]['depleted'] is None
    assert ui['samples'][9]['viewport'] == [390, 844]
    loop = ui['samples'][7]['frames']
    assert len(loop) > 20 and all(f['glError'] == 0 for f in loop)
    assert all(f['inventory']['fiber'] == 0 for f in loop if f['age'] < .21)
    assert loop[-1]['inventory']['fiber'] == 2
    assert sum(a['inventory']['fiber'] != b['inventory']['fiber'] for a, b in zip(loop, loop[1:])) == 1
    native = read('gather-contact-native-ui.json')
    assert not native['console'] and len(native['steps']) == 2
    for entry, item, before in [(native['steps'][0], 'berry', 3), (native['steps'][1], 'stone', 0)]:
        frames = entry['timing']['frames']
        assert len(frames) >= 30 and frames[0]['inventory'][item] == before
        assert all(f['inventory'][item] == before for f in frames if f['age'] < .21)
        assert frames[-1]['inventory'][item] == before + 2
        effects = [e for e in entry['timing']['effects'] if e['kind'] == 'gather']
        assert len(effects) == 1 and effects[0]['scheduled'] and effects[0]['age'] >= .21
        error = math.atan2(math.sin(frames[-1]['rootYaw'] - frames[-1]['targetYaw']),
                           math.cos(frames[-1]['rootYaw'] - frames[-1]['targetYaw']))
        assert abs(error) < .01
        assert frames[-1]['shoulder'] == frames[-1]['torsoYaw'] == 0
    ordinary = read('gather-contact-package-ui.json')
    assert ordinary['newGame'] and not ordinary['fixtureImported'] and not ordinary['console']
    steps = {s['label']: s for s in ordinary['steps']}
    assert inventory(steps['fresh-bag'])['木材'] == inventory(steps['fresh-bag'])['石料'] == 0
    desktop, restored = steps['desktop-three-resource-bag'], steps['mobile-restored-resource-bag']
    assert inventory(desktop) == inventory(restored) and desktop['coordinates'] == restored['coordinates']
    assert all(inventory(desktop)[name] == 2 for name in ['木材', '石料', '纤维'])
    assert inventory(steps['mobile-second-tree-bag'])['木材'] == 4
    ready = inventory(steps['mobile-second-stone-bag'])
    crafted, final = steps['mobile-crafted-axe-bag'], steps['mobile-final-restored-bag']
    result = inventory(final)
    assert result == inventory(crafted)
    assert ready['木材'] - result['木材'] == 4 and ready['石料'] - result['石料'] == 3
    assert result['木材'] == 0 and result['石料'] == result['石斧'] == 1
    assert result['纤维'] == 2 and result['浆果'] == 3
    assert steps['mobile-keeper-talk']['quest'] == '荒野的第一把工具'
    assert crafted['quest'] == final['quest'] == '在岛上安一个家'
    assert final['hp'] == '100' and final['coordinates'] == crafted['coordinates']
    assert final['width'] == final['scrollWidth'] == 390
    for name, expected in review['imagesViewedSha256'].items():
        assert sha(ROOT / name) == expected, name
    evidence = sorted(set(DOCS.glob('gather-contact-*.json')) | set(DOCS.glob('gather-contact-*-tests.txt')) |
                      set(DOCS.glob('gather-contact-*.jpg')) | set(DOCS.glob('gather-package-*.jpg')) |
                      {DOCS / (NAME + '-verification.json')})
    evidence = [p for p in evidence if p.name not in ('gather-contact-review.json', 'gather-contact-final-audit.json')]
    report = {'kind': 'bounded-gather-evidence-audit', 'passed': True, 'fullGoalComplete': False,
              'milestoneM5Complete': False, 'pendingBatchEvidence': [], 'changedProduction': sorted(changed),
              'runtimeSha256': {n: sha(ROOT / n) for n in build['files'] if n.startswith('src/')},
              'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
              'historicalArchivesPreserved': len(review['historicalArchives']),
              'ordinaryFinal': {'coordinates': final['coordinates'], 'hp': final['hp'],
                                'quest': final['quest'], 'inventory': result},
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for p in evidence},
              'limits': review['remainingQuality']}
    (DOCS / 'gather-contact-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('passed', 'fullGoalComplete', 'historicalArchivesPreserved', 'ordinaryFinal')}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    audit()
