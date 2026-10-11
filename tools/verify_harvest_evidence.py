"""Audit saved resource-kind harvesting evidence; no full-quality claim."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
NAME = 'tidelands-m5-2026-10-12-harvest'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((DOCS / name).read_text())


def inventory(step):
    return {item['name']: int(item['count']) for item in step['inventory']}


def audit():
    review = read('gather-kind-review.json')
    for name, value in review['validationSourceSha256'].items():
        assert sha(ROOT / name) == value, name
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    old = json.loads((ROOT / 'dist' / 'tidelands-m5-2026-10-12-gather.json').read_text())
    changed = {n for n in old['files'] if n.startswith('src/') and sha(ROOT / n) != old['files'][n]['sha256']}
    assert changed == {'src/character.js', 'src/scene.js', 'src/main.js'}, changed
    assert len(build['files']) == 40 and not build['fullGoalComplete']
    assert sha(ROOT / 'dist' / (NAME + '.zip')) == build['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / (NAME + '.zip')) as archive:
        assert len(archive.namelist()) == 41 and archive.testzip() is None
        for name, entry in build['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert sha(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == entry['sha256'], name
    assert len(review['historicalArchives']) == 23
    for name, value in review['historicalArchives'].items():
        assert sha(ROOT / 'dist' / name) == value, name
    for kind, count in [('focused', 34), ('full', 163)]:
        log = (DOCS / ('gather-kind-' + kind + '-tests.txt')).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert re.search(r'^# fail 3$', (DOCS / 'gather-kind-red-tests.txt').read_text(), re.M)
    assert 'Ran 4 tests' in (DOCS / 'gather-kind-package-tests.txt').read_text()
    assert read('gather-kind-syntax.json')['passed']
    numerical = read('gather-kind-numerical.json')
    assert len(numerical['samples']) == 12
    for name, value in numerical['sourceSha256'].items():
        assert sha(ROOT / name) == value, name
    for sample in numerical['samples']:
        assert sample['minimumPalmHeight'] > .08 and sample['minimumSoleGap'] > -1e-7
        low = sample['kind'] in ('berry', 'fiber', 'shell')
        assert sample['visibleTool'] == ('hand' if low or not sample['owned'] else 'axe')
        if low:
            assert sample['palmBounds']['max'][1] < ( .8 if sample['kind'] == 'shell' else 1.15)
            assert sample['pelvisOffset'] < -.3
    ui = read('gather-kind-ui.json')
    assert len(ui['samples']) == 16 and not ui['console'] and all(s['glError'] == 0 for s in ui['samples'])
    for sample in ui['samples']:
        if sample['label'].startswith('before-'):
            assert not sample['result'] and sample['depleted'] is None and sample['visibleTool'] != 'sword'
        if sample.get('frames'):
            frames = sample['frames'];assert len(frames) >= 30 and all(f['glError'] == 0 for f in frames)
            item = 'berry' if sample['node']['type'] == 'berry' else 'shell'
            assert all(f['inventory'][item] == 0 for f in frames if f['age'] < .21)
            assert frames[-1]['inventory'][item] == 2 and frames[-1]['visibleTool'] == 'sword'
            assert all(f['visibleTool'] == 'hand' for f in frames if f['age'] < .42)
    native = read('gather-kind-native-ui.json')
    assert len(native['steps']) == 2 and not native['console']
    for step, item, before, added, tool in [(native['steps'][0], 'berry', 3, 2, 'hand'),
                                           (native['steps'][1], 'stone', 0, 3, 'axe')]:
        frames = step['timing']['frames'];assert len(frames) >= 30
        assert all(f['inventory'][item] == before for f in frames if f['age'] < .21)
        assert all(f['visibleTool'] == tool for f in frames if f['age'] < .42)
        assert frames[-1]['visibleTool'] == 'sword' and frames[-1]['inventory'][item] == before + added
        effects = [e for e in step['timing']['effects'] if e['kind'] == 'gather']
        assert len(effects) == 1 and effects[0]['scheduled'] and effects[0]['age'] >= .21
    ordinary = read('gather-kind-package-ui.json')
    assert ordinary['newGame'] and not ordinary['fixtureImported'] and not ordinary['console']
    steps = {s['label']: s for s in ordinary['steps']}
    assert inventory(steps['fresh-bag-verified'])['浆果'] == 3
    assert inventory(steps['desktop-berry-bag']) == inventory(steps['mobile-restored-bag'])
    assert inventory(steps['desktop-berry-bag'])['浆果'] == 5
    final = steps['mobile-final-restored-bag'];result = inventory(final)
    assert result == inventory(steps['mobile-fiber-bag']) and result['纤维'] == 2 and result['浆果'] == 5
    assert result['木材'] == result['石料'] == result['石斧'] == result['晶石剑'] == 0
    assert final['coordinates'] == steps['mobile-fiber-bag']['coordinates'] and final['hp'] == '100'
    assert final['quest'] == '荒野的第一把工具' and final['width'] == final['scrollWidth'] == 390
    for name, value in review['imagesViewedSha256'].items():
        assert sha(ROOT / name) == value, name
    evidence = [p for p in sorted(DOCS.glob('gather-kind-*'))
                if p.name not in ('gather-kind-review.json', 'gather-kind-final-audit.json')]
    report = {'kind': 'bounded-harvest-evidence-audit', 'passed': True, 'fullGoalComplete': False,
              'milestoneM5Complete': False, 'pendingBatchEvidence': [], 'changedProduction': sorted(changed),
              'runtimeSha256': {n: sha(ROOT / n) for n in build['files'] if n.startswith('src/')},
              'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
              'historicalArchivesPreserved': len(review['historicalArchives']),
              'ordinaryFinal': {'coordinates': final['coordinates'], 'hp': final['hp'], 'quest': final['quest'], 'inventory': result},
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for p in evidence}, 'limits': review['remainingQuality']}
    (DOCS / 'gather-kind-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('passed', 'fullGoalComplete', 'historicalArchivesPreserved', 'ordinaryFinal')}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    audit()
