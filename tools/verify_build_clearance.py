"""Audit the bounded construction fix, native evidence and immutable local delivery."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    name = 'tidelands-m5-2026-10-26-build-clearance'
    package = load(f'dist/{name}.json')
    unpack = load(f'docs/{name}-verification.json')
    old = load('dist/tidelands-m5-2026-10-26-camp-architecture.json')
    assert len(package['files']) == 97 and package['archiveEntries'] == 98
    archive = ROOT / 'dist' / package['archive']
    assert archive.stat().st_size == package['archiveBytes'] == 15068506
    assert sha(archive) == package['archiveSha256'] == unpack['archiveSha256']
    assert unpack['passed'] and unpack['checkedFiles'] == 97
    assert sha(ROOT / 'dist' / old['archive']) == old['archiveSha256']
    assert package['builderSha256'] == old['builderSha256']
    changed = [n for n, row in package['files'].items()
               if old['files'].get(n, {}).get('sha256') != row['sha256']]
    assert changed == ['README.md', 'src/game.js'], changed
    with zipfile.ZipFile(archive) as bundle:
        for n, row in package['files'].items():
            current = ROOT / ('docs/LOCAL-DELIVERY.md' if n == 'README.md' else n)
            assert sha(current) == sha(Path(unpack['extractedPath']) / n) == row['sha256'], n
            assert hashlib.sha256(bundle.read('tidelands-local/' + n)).hexdigest() == row['sha256'], n
    for suffix, total, failures in [('red', 5, 4), ('focused', 34, 0), ('full-tests', 322, 0)]:
        log = (ROOT / f'docs/build-resource-clearance-{suffix}.txt').read_text()
        assert f'# tests {total}\n' in log and f'# fail {failures}\n' in log
    native = load('docs/build-clearance-browser.json')
    assert len(native['rows']) == 8 and native['console'] == []
    rows = {r['label']: r for r in native['rows']}
    for r in native['rows']:
        assert r['before']['glError'] == r['after']['glError'] == 0
    for label in ['fixed-blocked', 'fixed-depleted']:
        r = rows[label]
        for key in ['inventory', 'quest', 'buildings', 'depleted']:
            assert r['before'][key] == r['after'][key], (label, key)
        assert not r['after']['buildings']
    assert '会恢复' in rows['fixed-depleted']['ax']
    for label in ['baseline-blocked', 'fixed-clear']:
        r = rows[label]
        assert len(r['after']['buildings']) == 1 and r['after']['quest'] == 3
        assert r['after']['inventory']['wood'] == 25 and r['after']['inventory']['stone'] == 27
    old_legacy, fixed = rows['baseline-legacy'], rows['fixed-legacy']
    assert old_legacy['before']['renderedHidden'] is False
    assert old_legacy['after']['inventory']['stone'] == 33
    assert old_legacy['after']['player']['hp'] == 62
    for phase in ['before', 'after']:
        assert fixed[phase]['stoneHidden'] is True and fixed[phase]['renderedHidden'] is True
        assert fixed[phase]['depleted'] == {'starter-1': 150}
    assert fixed['before']['buildings'] == fixed['after']['buildings'] == old_legacy['before']['buildings']
    assert fixed['before']['inventory'] == fixed['after']['inventory']
    assert fixed['before']['player']['hp'] == 62 and fixed['after']['player']['hp'] == 100
    assert rows['baseline-legacy-walk']['after']['player']['z'] == 98
    walk = rows['fixed-legacy-walk']
    assert walk['after']['player']['z'] - walk['before']['player']['z'] > 6
    for key in ['buildings', 'depleted', 'inventory']:
        assert walk['before'][key] == walk['after'][key]
    ordinary = load('docs/build-clearance-package-browser.json')
    assert ordinary['console'] == []
    for key in ['ax', 'mobileAx']:
        assert 'progress indicator Value: 79, ID: hp' in ordinary[key]
        assert '群岛，再次相连' in ordinary[key]
        assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary[key]
    for item in ['木材', '石料', '纤维', '石斧']:
        assert item in ordinary['bagAx']
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images = list((ROOT / 'docs').glob('build-clearance-*.jpg'))
    assert len(images) == 10 and all(p.stat().st_size > 10000 for p in images)
    report = dict(verified=True, boundedConstructionFixAccepted=True, archive=package['archive'],
                  archiveSha256=package['archiveSha256'], runtimeInputs=97, fullTests=322,
                  focusedTests=34, redFailures=4, nativeFixtureCases=8, imagesViewed=10,
                  ordinaryDesktopRestored=True, ordinary390ReloadRestored=True,
                  legacyBuildingAndRecoveryRecordPreserved=True, realtime150SecondWait=False,
                  currentFullJourneyReplayed=False, currentGpuOrEnduranceAccepted=False,
                  newJsonExported=False, realDeviceVerified=False, audioListening=False,
                  milestoneM5Complete=False, fullGoalComplete=False)
    (ROOT / 'docs/build-clearance-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    verify()
