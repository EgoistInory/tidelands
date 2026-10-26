"""Verify the bounded four-role cloth increment and its independent local delivery."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    name = 'tidelands-m5-2026-10-27-cast-clothing'
    package = read(f'dist/{name}.json')
    unpack = read(f'docs/{name}-verification.json')
    old = read('dist/tidelands-m5-2026-10-26-regional-woodland.json')
    archive = ROOT / 'dist' / package['archive']
    assert len(package['files']) == unpack['checkedFiles'] == 110
    assert package['archiveEntries'] == 111 and unpack['passed']
    assert archive.stat().st_size == package['archiveBytes'] == 15687825
    assert sha(archive) == package['archiveSha256'] == unpack['archiveSha256']
    assert sha(ROOT / 'dist' / old['archive']) == old['archiveSha256']
    assert package['builderSha256'] == old['builderSha256'] == sha(ROOT / 'tools/package_local.py')
    changed = [n for n, row in package['files'].items() if old['files'].get(n, {}).get('sha256') != row['sha256']]
    assert changed == ['README.md', 'src/authored-wardrobe.js'], changed
    assert set(old['files']) == set(package['files'])
    with zipfile.ZipFile(archive) as bundle:
        for n, row in package['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if n == 'README.md' else n)
            assert sha(source) == sha(Path(unpack['extractedPath']) / n) == row['sha256'], n
            assert hashlib.sha256(bundle.read('tidelands-local/' + n)).hexdigest() == row['sha256'], n
    for suffix, total, failures in [('red', 2, 2), ('cross-leg-red', 3, 1), ('focused', 16, 0), ('full-tests', 330, 0)]:
        log = (ROOT / f'docs/cast-clothing-{suffix}.txt').read_text()
        assert f'# tests {total}\n' in log and f'# fail {failures}\n' in log
    assert '0.2518287833956722' in (ROOT / 'docs/cast-clothing-cross-leg-red.txt').read_text()
    assert (ROOT / 'docs/cast-clothing-initial-candidate.js.txt').is_file()
    initial = read('docs/cast-clothing-browser.json')
    assert len(initial) == 4
    r2 = read('docs/cast-clothing-r2-browser.json')
    final = read('docs/cast-clothing-final-browser.json')
    mobile = read('docs/cast-clothing-390.json')
    assert len(r2) == 12 and len(final) == 10 and len(mobile) == 2
    valid_pairs = [r2[i:i + 2] for i in range(0, 12, 2) if r2[i]['camera'] != 'side']
    valid_pairs += [final[i:i + 2] for i in range(0, 10, 2)] + [mobile]
    for baseline, candidate in valid_pairs:
        assert baseline['art'] == 'baseline' and candidate['art'] == 'candidate'
        for field in ['camera', 'pose', 'time', 'roles', 'animals', 'viewport', 'buffer']:
            assert baseline[field] == candidate[field], field
        if 'cameraPosition' in baseline:
            assert baseline['cameraPosition'] == candidate['cameraPosition']
        for row in [baseline, candidate]:
            assert row['glError'] == 0 and not row['hidden'] and row['soleError'] < .003
            assert [r['role'] for r in row['roles']] == ['traveler', 'keeper', 'botanist', 'explorer']
            assert all(r['clothMeshes'] == 4 for r in row['roles'])
    side = next(r for r in final if r['camera'] == 'side')
    assert side['cameraTarget'] == 'traveler' and side['cameraPosition'][0] < -6
    ensemble = [r for r in final if r['camera'] == 'ensemble']
    assert ensemble[1]['render']['triangles'] - ensemble[0]['render']['triangles'] == 6144
    assert ensemble[1]['render']['calls'] - ensemble[0]['render']['calls'] == 16
    assert ensemble[0]['render']['textures'] == ensemble[1]['render']['textures']
    motion = read('docs/cast-clothing-motion.json')
    assert motion['frames'] == 180 and not motion['running'] and not motion['hidden']
    assert motion['glError'] == 0 and motion['soleError'] < .003
    assert abs(motion['roles'][0]['position'][0] - 4.5) < 1e-6
    assert abs(motion['roles'][0]['position'][1] - 10.5) < 1e-6
    assert all(r['viewport'] == r['buffer'] == [390, 844] for r in mobile)
    oversampled = read('docs/cast-clothing-390-oversampled.json')
    assert all(r['viewport'] == [390, 844] and r['buffer'] == [585, 1266] for r in oversampled)
    assert read('docs/cast-clothing-console.json') == []
    main = read('docs/cast-clothing-main.json')
    assert main['console'] == [] and len(main['rows']) == 3
    before, gathered, walked = [r['state'] for r in main['rows']]
    assert before['inventory']['wood'] == 1 and gathered['inventory']['wood'] == walked['inventory']['wood'] == 4
    assert 'starter-0' in gathered['depleted']
    assert walked['player']['z'] - gathered['player']['z'] > 2
    assert all(r['glError'] == 0 and all(role['cloth'] == 4 for role in r['roles']) for r in [before, gathered, walked])
    ordinary = read('docs/cast-clothing-package-browser.json')
    assert ordinary['console'] == []
    for key in ['ax', 'mobileAx']:
        assert 'progress indicator Value: 79, ID: hp' in ordinary[key]
        assert '群岛，再次相连' in ordinary[key]
        assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary[key]
    for item, value in [('木材', 4), ('石料', 5), ('纤维', 6), ('浆果', 3), ('石斧', 1)]:
        assert re.search(r'text ' + item + r'\n\s*\d+ text ' + str(value) + r'\n', ordinary['bagAx'])
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images = list((ROOT / 'docs').glob('cast-clothing-*.jpg'))
    assert len(images) == 34 and all(p.stat().st_size > 10000 for p in images)
    report = dict(verified=True, boundedClothingIncrementAccepted=True, archive=package['archive'],
                  archiveSha256=package['archiveSha256'], archiveBytes=package['archiveBytes'], runtimeInputs=110,
                  changedRuntimeInputs=changed, fullTests=330, focusedTests=16, newTests=3,
                  initialRedFailures=2, crossLegRedFailures=1, nativeImagesViewed=34,
                  acceptedStaticPairs=len(valid_pairs), rejectedCrossLegCandidatePreserved=True,
                  rejectedOccludedSidePairPreserved=True, oversampledMobilePairPreserved=True, diagnosticMotionFrames=180,
                  motionRaf=motion['raf'], mainNativeGatherAndWalk=True,
                  ordinaryDesktopRestored=True, ordinary390ReloadRestored=True,
                  currentFullJourneyReplayed=False, currentGpuOrEnduranceAccepted=False,
                  audioListening=False, physicalDeviceVerified=False, clothingCollisionFreeAccepted=False,
                  milestoneM5Complete=False, fullGoalComplete=False)
    (ROOT / 'docs/cast-clothing-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    verify()
