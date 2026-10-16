"""Bind the finite regional-grove batch to its actual local delivery and evidence."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-16-ecosystem'


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    package = read(f'dist/{NAME}.json')
    delivery = read(f'docs/{NAME}-verification.json')
    assert delivery['passed'] and delivery['checkedFiles'] == 51
    assert package['archiveEntries'] == 52 and not package['fullGoalComplete']
    assert sha(ROOT / 'dist' / package['archive']) == package['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert archive.testzip() is None
        for name, entry in package['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name)
            assert sha(source) == entry['sha256'], name
            assert sha(Path(delivery['extractedPath']) / name) == entry['sha256'], name
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == entry['sha256'], name
    previous = read('dist/tidelands-m5-2026-10-16-motion-sound.json')
    changed = sorted(name for name in previous['files'] if previous['files'][name]['sha256'] != package['files'][name]['sha256'])
    assert set(changed) == {'README.md', 'src/camera.js', 'src/foliage.js', 'src/landscape.js', 'src/scene.js', 'src/tree.js', 'src/world.js'}
    for file, count in [('ecosystem-tests.txt', 230), ('ecosystem-focused.txt', 33)]:
        text = (ROOT / 'docs' / file).read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    assert 'Ran 4 tests' in (ROOT / 'docs/ecosystem-pack-tests.txt').read_text()
    pictures = read('docs/ecosystem-final-render.json')
    assert len(pictures['rows']) == 9 and not pictures['console']
    assert all(r['ready'] and r['trees'] == 309 and r['glError'] == 0 and len(r['treeBatches']) == 8 for r in pictures['rows'])
    camera = read('docs/ecosystem-camera-render.json')
    assert len(camera['rows']) == 6 and not camera['console']
    assert all(r['row']['frames'] == 180 and r['row']['maxIntentOverwriteDegrees'] == 0 and r['row']['minFocusDistance'] >= 6 and r['glError'] == 0 for r in camera['rows'])
    shoal = next(r['row'] for r in camera['rows'] if r['route'] == 'shoal')
    assert shoal['maxRenderedBearingStepDegrees'] < 12
    gpu = {}
    for name, viewport in [('desktop', [1920, 1080]), ('mobile', [390, 844])]:
        data = read(f'docs/ecosystem-gpu-{name}.json'); sample = data['sample']
        assert sample['complete'] and not sample['hidden'] and sample['disjointCount'] == 0 and not data['console']
        assert sample['canvasCssSize'] == sample['canvasBuffer'] == sample['viewport'] == viewport
        assert len(sample['rows']) == 5 and all(r['gpuMs']['samples'] == 60 and len(r['gpuRawMs']) == 60 for r in sample['rows'])
        gpu[name] = {r['phase']: r['gpuMs']['p95'] for r in sample['rows']}
    grove = read('docs/ecosystem-grove-ui.json')
    assert not grove['console'] and not grove['ordinarySaveOperated']
    # Earlier AX captures are diffs; absence there cannot prove a hidden tree/button.
    # The before/after/restored screenshots were viewed, and the final bag is a full tree.
    assert '存档已保存。' in grove['saved']
    assert 'text 木材\n' in grove['restoredBag'] and 'text 3\n' in grove['restoredBag']
    normal = read('docs/ecosystem-package-ui.json'); rows = {r['kind']: r['ax'] for r in normal['rows']}
    assert not normal['console'] and normal['nativeInput'] and not normal['fixtureImported'] and not normal['runtimeEdited']
    assert '位置 X 10.8，Z 77.4；建筑 1；击败 3' in rows['initial']
    assert '位置 X 9.9，Z 71.8；建筑 1；击败 3' in rows['mobileRestoredWorld'] and 'Value: 79, ID: hp' in rows['mobileRestoredWorld']
    assert 'text 木材\n' in rows['mobileRestoredBag'] and 'text 4\n' in rows['mobileRestoredBag'] and 'text 5\n' in rows['mobileRestoredBag']
    assert sha(ROOT / 'docs/island-spaces-normal-save.json') == 'e750698e0f888933e089bf8b0e76ebd9890c36d9bd8fcc1b3f5188f80709439c'
    images = sorted(ROOT.glob('docs/ecosystem-final-*.png')) + sorted(ROOT.glob('docs/ecosystem-grove-*.png')) + sorted(ROOT.glob('docs/ecosystem-package-*.png'))
    assert len(images) == 14
    report = {'batchDelivered': True, 'fullGoalComplete': False, 'milestoneM5Complete': False, 'archive': package['archive'], 'archiveSha256': package['archiveSha256'], 'archiveBytes': package['archiveBytes'], 'changedInputs': changed, 'checkedFiles': 51, 'fullTests': 230, 'focusedTests': 33, 'groveAdded': 128, 'worldTrees': 309, 'gpuP95Ms': gpu, 'ordinaryOrigin': normal['ordinaryOrigin'], 'ordinaryNewJsonDownloaded': False, 'currentSourceEnduranceAccepted': False, 'fullCurrentJourneyReplayed': False, 'realMobileDevice': False, 'audioListened': False, 'physicalCameraQualityComplete': False, 'imageSha256': {str(p.relative_to(ROOT)): sha(p) for p in images}, 'evidence': ['docs/ecosystem-final-render.json', 'docs/ecosystem-camera-render.json', 'docs/ecosystem-grove-ui.json', 'docs/ecosystem-package-ui.json'], 'scope': 'Regional ecosystem batch only; current GPU queries are bounded fixtures without audio/HUD. Prior source endurance/campaign reports remain historical.'}
    (ROOT / 'docs/ecosystem-delivery-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('batchDelivered', 'archiveSha256', 'checkedFiles', 'fullTests', 'focusedTests', 'fullGoalComplete')}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
