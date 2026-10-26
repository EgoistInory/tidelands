"""Audit actual CC0 acquisition, candidate budgets and bounded native comparisons."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
sha = lambda data: hashlib.sha256(data).hexdigest()
load = lambda name: json.loads((ROOT / name).read_text())


def verify():
    source = load('docs/forest-collection-acquisition.json')
    total = 0
    for name, row in source['files'].items():
        data = (ROOT / 'dist/forest-collection-source' / name).read_bytes()
        assert len(data) == row['bytes'] and sha(data) == row['sha256']
        assert hashlib.md5(data).hexdigest() == row['publishedMd5']
        total += len(data)
    assert total == source['actualSourceBytes'] == 28507028 and source['license'] == 'CC0-1.0'
    assert source['productionIntegrated'] is False and source['visualAccepted'] is False
    tool = ROOT / 'tools/vendor/meshoptimizer-0.24/meshopt_simplifier.mjs'
    assert sha(tool.read_bytes()) == '68f7b94830e3be31b7f08eb09c01b5c3867c74437d27807629541b3874bab567'
    assert 'MIT License' in (tool.parent / 'LICENSE.md').read_text()
    geometry = load('docs/forest-collection-geometry-manifest.json')['models']
    assert geometry['fir_sapling']['inputTriangles'] == 433021 and geometry['fir_sapling']['outputTriangles'] == 25440
    assert geometry['rock_moss_set_01']['outputTriangles'] == 10798
    textures = load('docs/forest-collection-texture-manifest.json')
    assert len(textures['files']) == 12 and textures['textureBytes'] == 653281
    for name, row in textures['files'].items():
        assert max(row['candidateSize']) <= 512
        assert sha((ROOT / 'dist/forest-collection-candidate' / name).read_bytes()) == row['sha256']
    candidate_files = {}
    for folder in ['forest-collection-candidate', 'forest-collection-fulltree']:
        for file in (ROOT / 'dist' / folder).rglob('*'):
            if file.is_file():
                candidate_files[str(file.relative_to(ROOT))] = {'sha256': sha(file.read_bytes()), 'bytes': file.stat().st_size}
    comparisons = []
    for file in ['forest-collection-browser.json', 'forest-collection-r2-browser.json']:
        rows = load('docs/' + file)['rows']
        assert len(rows) == 10
        for a, b in zip(rows[::2], rows[1::2]):
            assert a['art'] == 'baseline' and b['art'] == 'candidate'
            for key in ['scene', 'position', 'time', 'camera', 'viewport', 'buffer']:
                assert a[key] == b[key], (file, key)
            assert a['glError'] == b['glError'] == 0 and a['worldUnchanged'] and b['worldUnchanged']
            comparisons.append({'revision': b.get('revision', 1), 'scene': b['scene'],
                                'baselineTriangles': a['render']['triangles'], 'candidateTriangles': b['render']['triangles'],
                                'baselineCalls': a['render']['calls'], 'candidateCalls': b['render']['calls']})
    mobile = load('docs/forest-collection-r2-mobile.json')
    assert len(mobile) == 2
    assert mobile[0]['position'] == mobile[1]['position'] and mobile[0]['camera'] == mobile[1]['camera']
    assert all(r['viewport'] == [390, 844] and r['glError'] == 0 for r in mobile)
    motion = load('docs/forest-collection-r2-motion.json')
    assert motion['frames'] == 180 and motion['hp'] == 100 and motion['worldUnchanged']
    assert motion['distance'] > 20.9 and not motion['hidden'] and motion['glError'] == 0
    assert load('docs/forest-collection-console-r1.json') == load('docs/forest-collection-console-r2.json') == []
    assert 'Ran 3 tests' in (ROOT / 'docs/forest-collection-boundary-tests.txt').read_text()
    images = list((ROOT / 'docs').glob('forest-collection-*.jpg'))
    assert len(images) == 23 and all(f.stat().st_size > 10000 for f in images)
    package = load('dist/tidelands-m5-2026-10-26-build-clearance.json')
    for name, row in package['files'].items():
        assert sha((ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)).read_bytes()) == row['sha256'], name
    assert sha((ROOT / 'dist' / package['archive']).read_bytes()) == package['archiveSha256']
    assert sha((ROOT / 'docs/beacon-footing-normal-save.json').read_bytes()) == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    report = dict(verified=True, acquiredSourceBytes=total, sourceFiles=len(source['files']),
                  sourceVariants=13, boundaryTests=3, nativeImagesViewed=23,
                  comparisons=comparisons, motionFrames=180, motionMetres=motion['distance'],
                  originalProductionInputsUnchanged=97, originalPackageSha256=package['archiveSha256'],
                  candidateFiles=candidate_files, firstPrunedFoliageRejected=True,
                  wholeCollectionProductionAccepted=False, productionIntegrated=False,
                  gpuOrEnduranceAccepted=False, ordinarySaveChanged=False,
                  milestoneM5Complete=False, fullGoalComplete=False)
    (ROOT / 'docs/forest-collection-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ['comparisons', 'candidateFiles']}))


if __name__ == '__main__':
    verify()
