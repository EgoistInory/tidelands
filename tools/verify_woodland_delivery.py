"""Audit regional groundcover integration and bounded native delivery evidence."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-26-regional-woodland'


def load(name):
    return json.loads((ROOT / name).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    package = load(f'dist/{NAME}.json')
    unpack = load(f'docs/{NAME}-verification.json')
    old = load('dist/tidelands-m5-2026-10-26-build-clearance.json')
    archive = ROOT / 'dist' / package['archive']
    assert len(package['files']) == unpack['checkedFiles'] == 110
    assert package['archiveEntries'] == 111 and unpack['passed']
    assert archive.stat().st_size == package['archiveBytes'] == 15687028
    assert sha(archive) == package['archiveSha256'] == unpack['archiveSha256']
    assert sha(ROOT / 'tools/package_local.py') == package['builderSha256']
    assert sha(ROOT / 'dist' / old['archive']) == old['archiveSha256']
    changed = {n for n, row in package['files'].items()
               if old['files'].get(n, {}).get('sha256') != row['sha256']}
    woodland = {n for n in package['files'] if n.startswith('assets/woodland/')}
    assert len(woodland) == 12
    assert changed == woodland | {'README.md', 'src/main.js', 'src/scene.js', 'src/woodland.js'}
    assert set(old['files']).issubset(package['files'])
    with zipfile.ZipFile(archive) as bundle:
        for name, row in package['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)
            assert sha(source) == sha(Path(unpack['extractedPath']) / name) == row['sha256'], name
            assert hashlib.sha256(bundle.read('tidelands-local/' + name)).hexdigest() == row['sha256'], name
    provenance = load('assets/woodland/provenance.json')
    assert provenance['license'] == 'CC0-1.0' and len(provenance['files']) == 11
    for name, row in provenance['files'].items():
        path = ROOT / 'assets/woodland' / name
        assert path.stat().st_size == row['bytes'] and sha(path) == row['sha256']
    for suffix, total, failures in [('red', 5, 5), ('focused', 14, 0), ('full-tests', 327, 0)]:
        log = (ROOT / f'docs/woodland-{suffix}.txt').read_text()
        assert f'# tests {total}\n' in log and f'# fail {failures}\n' in log
    assert 'Ran 6 tests' in (ROOT / 'docs/woodland-packaging-tests.txt').read_text()
    assert (ROOT / 'docs/woodland-packaging-tests.txt').read_text().rstrip().endswith('OK')
    assert 'FAILED (failures=1)' in (ROOT / 'docs/woodland-packaging-red.txt').read_text()
    rows = load('docs/woodland-browser.json')['rows']
    assert len(rows) == 10
    pairs = [rows[i:i + 2] for i in range(0, 10, 2)]
    pairs += [load('docs/woodland-grove.json'), load('docs/woodland-mobile.json')]
    for baseline, candidate in pairs:
        assert baseline['art'] == 'baseline' and candidate['art'] == 'candidate'
        for field in ['position', 'camera', 'time', 'viewport', 'buffer']:
            assert baseline[field] == candidate[field], field
        for row in [baseline, candidate]:
            assert row['worldUnchanged'] and row['placements'] == 1445 and row['glError'] == 0
    motion = load('docs/woodland-grove-motion.json')
    assert motion['frames'] == 180 and 20.99 < motion['distance'] < 21.01
    assert motion['hp'] == 100 and motion['worldUnchanged'] and not motion['hidden'] and motion['glError'] == 0
    rejected = load('docs/woodland-motion.json')
    assert rejected['frames'] == 180 and rejected['distance'] < 2 and rejected['hp'] < 100
    mobile = load('docs/woodland-grove-390.json')
    assert mobile['viewport'] == mobile['buffer'] == [390, 844] and mobile['glError'] == 0
    for name in ['console', 'grove-console', 'main-console']:
        assert load(f'docs/woodland-{name}.json') == []
    before, after = [row['state'] for row in load('docs/woodland-main.json')]
    assert before['buildings'] == [] and before['hiddenDressing'] == 0 and before['quest'] == 2
    assert len(after['buildings']) == 1 and after['quest'] == 3 and after['hiddenDressing'] == 6
    assert after['inventory']['wood'] == 25 and after['inventory']['stone'] == 27
    assert before['player'] == after['player'] and after['dressingInstalled'] and after['glError'] == 0
    failure = load('docs/woodland-missing-geometry-fixture.json')
    assert len(failure['omitted']) == 4 and not failure['productionFilesModified']
    for name, row in package['files'].items():
        path = Path(failure['fixture']) / name
        if name in failure['omitted']:
            assert not path.exists()
        else:
            assert sha(path) == row['sha256'], name
    fallback = load('docs/woodland-fallback-browser.json')
    assert '部分林下细节暂未载入 · 可以继续' in fallback['startAx']
    assert 'button 开始旅程' in fallback['startAx'] and 'button (disabled)' not in fallback['startAx']
    def position(ax):
        match = re.search(r'位置 X ([-\d.]+)，Z ([-\d.]+)', ax)
        assert match
        return tuple(map(float, match.groups()))
    a, b = position(fallback['beforeAx']), position(fallback['afterAx'])
    assert sum((x - y) ** 2 for x, y in zip(a, b)) > 4
    ordinary = load('docs/woodland-package-browser.json')
    assert ordinary['console'] == []
    for key in ['ax', 'mobileAx']:
        assert 'progress indicator Value: 79, ID: hp' in ordinary[key]
        assert '群岛，再次相连' in ordinary[key]
        assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary[key]
    for item, value in [('木材', 4), ('石料', 5), ('纤维', 6), ('浆果', 3), ('石斧', 1)]:
        assert re.search(r'text ' + item + r'\n\s*\d+ text ' + str(value) + r'\n', ordinary['bagAx'])
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images = list((ROOT / 'docs').glob('woodland-*.jpg'))
    assert len(images) == 24 and all(p.stat().st_size > 10000 for p in images)
    report = dict(verified=True, boundedRegionalGroundcoverAccepted=True,
                  archive=package['archive'], archiveSha256=package['archiveSha256'],
                  archiveBytes=package['archiveBytes'], runtimeInputs=110,
                  assetFiles=12, assetBytes=sum(package['files'][n]['bytes'] for n in woodland),
                  fullTests=327, focusedTests=14, redFailures=5, packagingTests=6,
                  placements=1445, comparisonPairs=7, nativeImagesViewed=24,
                  productionMainBuildClearedInstances=6, missingGeometryFallbackPlayable=True,
                  motionFrames=180, motionMetres=motion['distance'], motionRaf=motion['raf'],
                  rejectedEnemyBlockedMotionRetained=True,
                  ordinaryDesktopRestored=True, ordinary390ReloadRestored=True,
                  currentFullJourneyReplayed=False, currentGpuOrEnduranceAccepted=False,
                  vramMeasured=False, newJsonExported=False, audioListening=False,
                  realDeviceVerified=False, milestoneM5Complete=False, fullGoalComplete=False)
    (ROOT / 'docs/woodland-integration-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    verify()
