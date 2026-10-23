"""Verify bounded night fill, source delta, and independent ordinary restore."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
load = lambda name: json.loads((ROOT / name).read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
NAME = 'tidelands-m5-2026-10-23-night-fill'


def verify():
    package = load('dist/' + NAME + '.json')
    previous = load('dist/tidelands-m5-2026-10-23-full-body-actions.json')
    extraction = load('docs/' + NAME + '-verification.json')
    assert sha(ROOT / 'dist' / package['archive']) == package['archiveSha256']
    assert package['archiveBytes'] == 15060640 and package['archiveEntries'] == 94
    assert len(package['files']) == 93 and extraction['passed'] and extraction['checkedFiles'] == 93
    assert previous['builderSha256'] == package['builderSha256'] == sha(ROOT / 'tools/package_local.py')
    assert 'Ran 5 tests' in (ROOT / 'docs/low-gather-package-tests.txt').read_text()
    changed = [p for p, row in package['files'].items() if row['sha256'] != previous['files'][p]['sha256']]
    assert changed == ['README.md', 'src/scene.js']
    with zipfile.ZipFile(ROOT / 'dist' / previous['archive']) as old:
        assert sha(ROOT / 'dist' / previous['archive']) == previous['archiveSha256']
        before = old.read('tidelands-local/src/scene.js').decode()
        old_energy = '(.6+Math.sqrt((daylight-.04)/.96)*1.5)*weather.skylight'
        new_energy = '(.6+Math.sqrt((daylight-.04)/.96)*1.5+.3*(1-bounceDay))*weather.skylight'
        assert before.count(old_energy) == 1
        assert before.replace(old_energy, new_energy) == (ROOT / 'src/scene.js').read_text()
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as packed:
        for name, row in package['files'].items():
            current = ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)
            assert sha(current) == row['sha256'], name
            assert sha(Path(extraction['extractedPath']) / name) == row['sha256'], name
            assert hashlib.sha256(packed.read('tidelands-local/' + name)).hexdigest() == row['sha256'], name
    evidence = load('docs/night-energy-browser.json')
    assert len(evidence['rows']) == 9 and evidence['console'] == []
    rows = {r['name']: r for r in evidence['rows']}
    for place in ['camp', 'forest', 'day', 'mobile']:
        a, b = rows[place + '-baseline'], rows[place + '-fill']
        for key in ['position', 'camera', 'time', 'orbit', 'viewport', 'buffer', 'colors', 'weather', 'hp']:
            assert a[key] == b[key], (place, key)
        assert a['energy']['sun'] == b['energy']['sun'] and a['energy']['moon'] == b['energy']['moon']
        assert a['energy']['fire'] == b['energy']['fire']
        if place == 'day':
            assert a['energy'] == b['energy']
        else:
            assert abs(b['energy']['ambient'] / a['energy']['ambient'] - 1.5) < 1e-12
    assert all(r['glError'] == 0 for r in rows.values())
    run = rows['mobile-move-fill']
    assert run['frames'] == 180 and not run['running'] and not run['hidden']
    assert run['viewport'] == [390, 844] and run['raf']['samples'] == 179 and run['distance'] > 16
    actual = load('docs/night-energy-production-browser.json')
    assert actual['console'] == [] and actual['row']['lighting'] == 'fill'
    assert actual['row']['viewport'] == [390, 844] and actual['row']['glError'] == 0
    assert actual['row']['energy'] == rows['camp-fill']['energy']
    ordinary = load('docs/night-fill-package-browser.json')
    assert ordinary['origin'] == 'http://127.0.0.1:59851' and ordinary['console'] == []
    for key in ['desktopAx', 'mobileAx']:
        assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary[key]
        assert '群岛，再次相连' in ordinary[key]
    # The desktop capture is an AX diff: its existing progress node was omitted.
    assert 'text 79\n' in ordinary['desktopAx']
    assert 'progress indicator Value: 79, ID: hp' in ordinary['mobileAx']
    assert ordinary['mobileViewport']['width'] == 390 and ordinary['mobileViewport']['height'] == 844
    for name, count in [('木材', 4), ('石料', 5), ('纤维', 6), ('浆果', 3), ('贝壳', 0), ('晶石', 0), ('石斧', 1), ('晶石剑', 0), ('烤浆果', 0)]:
        assert re.search(r'text ' + name + r'\n\s+\d+ text ' + str(count) + r'\n', ordinary['bagAx'])
    images = ['night-energy-' + n for n in ['camp-baseline', 'camp-fill', 'forest-baseline', 'forest-fill',
        'day-baseline', 'day-fill', 'mobile-baseline', 'mobile-fill', 'mobile-move', 'production-mobile']]
    images += ['night-fill-package-ordinary', 'night-fill-package-mobile']
    for name in images:
        assert (ROOT / 'docs' / (name + '.jpg')).read_bytes()[:2] == b'\xff\xd8'
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    for name, tests in [('focused', 10), ('full-tests', 301)]:
        log = (ROOT / ('docs/night-fill-' + name + '.txt')).read_text()
        assert '# tests ' + str(tests) in log and '# fail 0' in log
    red = (ROOT / 'docs/night-fill-red.txt').read_text()
    assert '# fail 1' in red and 'night needs a visible fill floor even under cloud' in red
    inputs = ['src/scene.js', 'tests/night-fill.test.js', 'tests/night-palette.test.js', 'tests/weather.test.js',
        'tests/night-energy-review.html', 'tests/night-energy-review.js', 'tools/verify_night_fill.py',
        'docs/night-energy-browser.json', 'docs/night-energy-production-browser.json', 'docs/night-fill-package-browser.json',
        'docs/night-fill-focused.txt', 'docs/night-fill-full-tests.txt', 'docs/night-fill-red.txt',
        'docs/' + NAME + '-verification.json'] + ['docs/' + name + '.jpg' for name in images]
    report = {'verified': True, 'boundedNightReadabilityDelivered': True, 'archive': package['archive'],
        'archiveSha256': package['archiveSha256'], 'archiveBytes': package['archiveBytes'],
        'runtimeInputs': 93, 'changedInputs': changed, 'extractedPath': extraction['extractedPath'],
        'fullTests': 301, 'focusedTests': 10, 'imagesViewed': 12,
        'ordinaryDesktopRestored': True, 'ordinary390ReloadRestored': True,
        'desktopAxIsDiff': True,
        'ordinaryNewJsonExported': False, 'currentExactSourceGpuAccepted': False,
        'currentExactSourceEnduranceAccepted': False, 'milestoneM5Complete': False, 'fullGoalComplete': False,
        'scope': 'Only CPU atmosphere fill energy and guide changed. Existing light/shadow count, draw graph and daylight/key/fire settings unchanged by exact source delta. Actual GPU/endurance evidence remains on its prior SHA; no new measurements or final art, audible sound, mesh-contact, physical-device acceptance.',
        'files': {name: sha(ROOT / name) for name in inputs}}
    (ROOT / 'docs/night-fill-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['verified', 'boundedNightReadabilityDelivered', 'archiveSha256', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
