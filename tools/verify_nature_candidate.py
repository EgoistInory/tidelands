"""Verify the bounded art spike and unchanged playable delivery, not M5 quality."""
from pathlib import Path
import hashlib
import json
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sha = lambda data: hashlib.sha256(data).hexdigest()


def verify():
    source = json.loads((ROOT / 'docs/nature-candidate-source.json').read_text())
    archive_path = ROOT / source['sourceArchive']
    assert sha(archive_path.read_bytes()) == source['archiveSha256']
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        assert len(archive.infolist()) == 459
        assert sum(i.filename.endswith('.gltf') for i in archive.infolist()) == 68
        for name, row in source['files'].items():
            data = (ROOT / 'dist/nature-candidate' / name).read_bytes()
            assert len(data) == row['bytes'] and sha(data) == row['sha256']
            assert sha(archive.read(row['sourceMember'])) == row['sourceSha256']
            if name.endswith('.png'):
                assert data[:8] == b'\x89PNG\r\n\x1a\n'
                assert list(struct.unpack('>II', data[16:24])) == row['candidateSize']
                assert max(row['candidateSize']) <= 512
    evidence = json.loads((ROOT / 'docs/nature-candidate-browser.json').read_text())
    rows = evidence['rows']
    assert len(rows) == 9 and evidence['console'] == []
    assert all(r['ready'] and r['worldUnchanged'] and r['glError'] == 0 for r in rows)
    for place in ['coast', 'forest', 'highland', 'camp']:
        pair = [r for r in rows if r['scene'] == place and r['frames'] == 0]
        assert len(pair) == 2 and {r['art'] for r in pair} == {'baseline', 'candidate'}
        for key in ['position', 'camera', 'time', 'viewport', 'buffer', 'hp']:
            assert pair[0][key] == pair[1][key], (place, key)
    mobile = [r for r in rows if r['scene'] == 'camp']
    assert all(r['viewport'] == [390, 844] for r in mobile)
    movement = next(r for r in rows if r['frames'] == 180)
    assert not movement['running'] and not movement['hidden']
    assert abs(movement['distance'] - 21) < .001 and movement['raf']['samples'] == 179
    images = ['nature-baseline-coast', 'nature-candidate-coast', 'nature-baseline-forest',
        'nature-candidate-forest', 'nature-baseline-highland', 'nature-candidate-highland',
        'nature-candidate-highland-move', 'nature-baseline-camp-mobile', 'nature-candidate-camp-mobile']
    for name in images:
        assert (ROOT / 'docs' / (name + '.jpg')).read_bytes()[:2] == b'\xff\xd8'
    manifest = json.loads((ROOT / 'dist/tidelands-m5-2026-10-23-full-body-actions.json').read_text())
    assert len(manifest['files']) == 93
    for name, row in manifest['files'].items():
        path = ROOT / name if name != 'README.md' else ROOT / 'docs/LOCAL-DELIVERY.md'
        assert sha(path.read_bytes()) == row['sha256'], ('Runtime drift', name)
    assert sha((ROOT / 'dist' / manifest['archive']).read_bytes()) == manifest['archiveSha256']
    assert sha((ROOT / 'docs/beacon-footing-normal-save.json').read_bytes()) == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    inputs = ['tools/prepare_nature_candidate.py', 'tools/verify_nature_candidate.py',
        'tests/authored-nature-review.html', 'tests/authored-nature-review.js',
        'docs/nature-candidate-source.json', 'docs/nature-candidate-browser.json']
    inputs += ['docs/' + name + '.jpg' for name in images]
    report = {'kind': 'bounded-authored-nature-spike', 'integrityPassed': True,
        'candidateAccepted': False, 'productionIntegrated': False,
        'reason': 'Additional authored silhouette detail does not resolve sparse scene composition; darker dense crowns and flat pine cards regress the current visual direction. Candidate lacks production wind and matching camera bounds.',
        'unchangedRuntimeInputs': 93, 'deliverySha256': manifest['archiveSha256'],
        'archiveCrcVerified': True, 'sourceFreeModelCount': 68, 'preparedModels': 11,
        'preparedFiles': len(source['files']), 'preparedBytes': source['candidateBytes'],
        'browserRows': 9, 'imagesViewed': 9, 'movement': movement,
        'inputSha256': {name: sha((ROOT / name).read_bytes()) for name in inputs},
        'm5Complete': False, 'fullGoalComplete': False,
        'limits': ['Frame scheduling is not a GPU performance result.',
                   'Static comparison includes both resident art pools; texture counts do not prove memory cost or leaks.',
                   'Old camera obstacles are intentional for the isolated comparison, not clearance acceptance.',
                   'No production modifications, normal-save mutation, new package, long-run, physical device or audio acceptance.']}
    (ROOT / 'docs/nature-candidate-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['integrityPassed', 'candidateAccepted', 'unchangedRuntimeInputs', 'browserRows', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
