"""Replay the bounded count/save evidence audit; this is not a full quality gate."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-12-buildlimit'


def read(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def verify():
    ui = read('docs/build-limit-ui.json')
    assert ui['imported']['buildingCount'] == 499
    assert ui['imported']['inventory']['wood'] == 40 and ui['imported']['inventory']['fiber'] == 15
    created = ui['created']
    assert created['buildingCount'] == 500 and created['lastBuilding']['type'] == 'tent'
    assert created['lastBuilding']['x'] == -70 and created['lastBuilding']['z'] == 108
    assert created['inventory']['wood'] == 32 and created['inventory']['fiber'] == 10
    assert created['respawn'] == {'x': -70, 'z': 112}
    fields = ('buildingCount', 'lastBuilding', 'inventory', 'position', 'quest', 'respawn')
    for key in ('rejected', 'rejectedAll', 'invalidImport', 'restored', 'mobileRejected'):
        sample = ui[key]
        assert all(sample[field] == created[field] for field in fields), key
        assert sample['viewCount'] == 1 and sample['glError'] == 0, key
    assert ui['restored']['viewport'] == [390, 844]
    assert '500 座上限' in ui['message'] and '500 座上限' in ui['mobileMessage']
    assert '导入失败：存档建筑数据无效' in ui['invalidImportText'] and ui['console'] == []
    before = read('docs/build-limit-formal-save-before.json')
    after = read('docs/build-limit-formal-save-after.json')
    assert before == after and before['readOnly'] and before['valid']
    ordinary = read('docs/build-limit-package-ui.json')
    assert ordinary['normalFreshGame'] and not ordinary['importedFixture'] and not ordinary['runtimeStateEdited']
    assert ordinary['console'] == [] and ordinary['mobile']['width'] == ordinary['mobile']['scrollWidth'] == 390
    for key in ('desktop', 'mobile'):
        sample = ordinary[key]
        assert sample['hp'] == '100' and sample['quest'] == '归航的灯火'
        assert {i['name']: i['count'] for i in sample['inventory']} == {
            '木材': '2', '石料': '0', '纤维': '0', '浆果': '3', '贝壳': '0',
            '晶石': '0', '石斧': '0', '晶石剑': '0', '烤浆果': '0'}
    assert ordinary['desktop']['coordinates'] == ordinary['mobile']['coordinates']
    for path, count in [('docs/build-limit-focused-tests.txt', 27), ('docs/build-limit-full-tests.txt', 176)]:
        text = (ROOT / path).read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    assert 'Ran 4 tests' in (ROOT / 'docs/build-limit-package-tests.txt').read_text()
    assert 'OK' in (ROOT / 'docs/build-limit-package-tests.txt').read_text()
    assert '# fail 2\n' in (ROOT / 'docs/build-limit-red-tests.txt').read_text()
    report = read(f'dist/{NAME}.json')
    check = read(f'docs/{NAME}-verification.json')
    assert check['passed'] and check['checkedFiles'] == 42 and check['archiveSha256'] == report['archiveSha256']
    assert sha(f'dist/{NAME}.zip') == report['archiveSha256']
    previous = read('dist/tidelands-m5-2026-10-12-campclear.json')
    for path, entry in report['files'].items():
        if path == 'README.md':
            assert sha('docs/LOCAL-DELIVERY.md') == entry['sha256']
        else:
            assert sha(path) == entry['sha256'], path
        if path not in ('src/game.js', 'README.md'):
            assert entry == previous['files'][path], path
    archives = sorted((ROOT / 'dist').glob('*.zip'))
    assert len(archives) == 29
    for archive in archives:
        saved = read(str(archive.relative_to(ROOT).with_suffix('.json')))
        assert sha(str(archive.relative_to(ROOT))) == saved['archiveSha256'], archive.name
    with zipfile.ZipFile(ROOT / 'dist' / f'{NAME}.zip') as archive:
        assert archive.testzip() is None and len(archive.namelist()) == 43
    evidence = sorted((ROOT / 'docs').glob('build-limit-*'))
    evidence += sorted((ROOT / 'tests/fixtures').glob('build-limit-*'))
    evidence += [ROOT / 'tests/build-limit.html', ROOT / 'tests/build-limit.test.js', ROOT / 'tools/build_limit_fixtures.mjs']
    evidence = [p for p in evidence if p.name != 'build-limit-final-audit.json']
    result = {'kind': 'bounded-build-save-count-audit', 'passed': True, 'fullGoalComplete': False,
              'milestoneM5Complete': False, 'changedProduction': ['src/game.js'],
              'archive': report['archive'], 'archiveBytes': report['archiveBytes'],
              'archiveSha256': report['archiveSha256'], 'historicalArchivesPreserved': 28,
              'actualUiBoundary': {'before': 499, 'after': 500, 'nextRejected': True,
                                  'fixtureImported': True, 'normalPlaythrough': False},
              'formalSaveUnchangedSha256': before['sha256'], 'ordinaryFinal': ordinary['mobile'],
              'evidenceSha256': {str(p.relative_to(ROOT)): sha(str(p.relative_to(ROOT))) for p in evidence},
              'limits': ['Count fixtures are explicit stress states, not ordinary resource gathering or full campaign.',
                         'No 500-building performance, device, GPU or final visual/audio quality gate.',
                         'Earlier guardless QA isolation claims remain withdrawn; only this run has before/after equality.',
                         'Full current campaign, unified character/environment art, natural contact and audition remain.',
                         'Public origin destination remains awaiting the existing human choice; no fetch/push.']}
    (ROOT / 'docs/build-limit-final-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ('kind', 'passed', 'archiveSha256', 'historicalArchivesPreserved', 'fullGoalComplete')}))


if __name__ == '__main__':
    verify()
