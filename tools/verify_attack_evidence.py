"""Replay the bounded attack batch; saved UI does not prove a full campaign or 3A quality."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
NAME = 'tidelands-m5-2026-10-12-attack'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(name):
    return json.loads((DOCS / name).read_text())


def audit():
    review = read('attack-contact-review.json')
    for name, expected in review['validationSourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    old = json.loads((ROOT / 'dist' / 'tidelands-m5-2026-10-12-wind.json').read_text())
    changed = {n for n in old['files'] if n.startswith('src/') and sha(ROOT / n) != old['files'][n]['sha256']}
    assert changed == {'src/character.js', 'src/game.js', 'src/main.js'}, changed
    assert not build['fullGoalComplete'] and sha(ROOT / 'dist' / (NAME + '.zip')) == build['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / (NAME + '.zip')) as archive:
        assert len(archive.namelist()) == 41 and archive.testzip() is None
        for name, entry in build['files'].items():
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert sha(ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)) == entry['sha256'], name
    for name, expected in review['historicalArchives'].items():
        assert sha(ROOT / 'dist' / name) == expected, name
    for kind, count in [('focused', 55), ('full', 156)]:
        log = (DOCS / ('attack-contact-' + kind + '-tests.txt')).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert 'Ran 4 tests' in (DOCS / 'attack-contact-package-tests.txt').read_text()
    soak = read('attack-contact-soak.json')
    assert soak['passed'] and soak['reloads'] == 60 and soak['sourceHash'] == sha(ROOT / 'src/game.js')
    numerical = read('attack-contact-numerical.json')
    for name, expected in numerical['sourceSha256'].items():
        assert sha(ROOT / name) == expected, name
    assert [len(s['hits']) for s in numerical['rules']] == [1, 0, 0, 0]
    ui = read('attack-contact-ui.json')
    assert not ui['console'] and all(s['glError'] == 0 for s in ui['samples'])
    assert ui['samples'][-1]['viewport'] == [390, 844]
    cases = {s['scenario']: s for s in ui['samples'] if s['selected'] == 'axe' and s['type'] == 'crab'}
    assert cases['front']['enemyHp'] == 17 and cases['back']['enemyHp'] == cases['far']['enemyHp'] == 40
    assert any(len(s['frames']) > 20 for s in ui['samples'])
    native = read('attack-contact-native-ui.json')
    assert not native['console']
    first, killed, missed = native['steps']
    for entry, before, after in [(first, 40, 2), (killed, 2, -36)]:
        frames = entry['timing']['frames']
        assert frames[0]['enemyHp'] == before and frames[-1]['enemyHp'] == after
        assert all(f['enemyHp'] == before for f in frames if f['age'] < .225)
        assert any(e['kind'] == 'hit' and e['scheduled'] and e['age'] >= .225 for e in entry['timing']['effects'])
    assert all(f['enemyHp'] == -36 for f in missed['timing']['frames'])
    assert all(e['kind'] != 'hit' for e in missed['timing']['effects'])
    ordinary = read('attack-contact-package-ui.json')
    assert ordinary['newGame'] and not ordinary['fixtureImported'] and not ordinary['console']
    steps = {s['label']: s for s in ordinary['steps']}
    strikes = [steps['close-hand-strike-' + str(i)] for i in range(1, 7)]
    assert [s['enemy']['hp'] for s in strikes[:5]] == ['58 / 70', '46 / 70', '34 / 70', '22 / 70', '10 / 70']
    assert '击败 1' in strikes[-1]['coordinates'] and strikes[-1]['hp'] == '52'
    final = steps['mobile-final-restored-inventory']
    inventory = {s['name']: int(s['count']) for s in final['inventory']}
    assert inventory['纤维'] == 2 and inventory['浆果'] == 3 and inventory['石斧'] == inventory['晶石剑'] == 0
    assert final['hp'] == '70' and final['coordinates'] == strikes[-1]['coordinates']
    assert steps['mobile-reload-kill']['hp'] == '52'
    assert steps['mobile-no-extra-reward']['feedback'] == '未命中 · 面向目标并靠近再攻击'
    evidence = sorted(set(DOCS.glob('attack-contact-*.json')) | set(DOCS.glob('attack-contact-*-tests.txt')) | set(DOCS.glob('attack-*.jpg')))
    evidence = [p for p in evidence if p.name not in ('attack-contact-review.json', 'attack-contact-final-audit.json')]
    for name, expected in review['imagesViewedSha256'].items():
        assert sha(ROOT / name) == expected, name
    report = {'kind': 'bounded-attack-evidence-audit', 'passed': True, 'fullGoalComplete': False, 'milestoneM5Complete': False,
              'pendingBatchEvidence': [], 'changedProduction': sorted(changed),
              'runtimeSha256': {n: sha(ROOT / n) for n in build['files'] if n.startswith('src/')},
              'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
              'historicalArchivesPreserved': len(review['historicalArchives']),
              'ordinaryFinal': {'coordinates': final['coordinates'], 'hp': final['hp'], 'inventory': inventory},
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for p in evidence}, 'limits': review['remainingQuality']}
    (DOCS / 'attack-contact-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('passed', 'fullGoalComplete', 'historicalArchivesPreserved', 'ordinaryFinal')}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    audit()
