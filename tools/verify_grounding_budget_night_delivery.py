"""Verify the frozen combined local delivery, without claiming full M5 quality."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-17-grounding-budget-night'


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    package = read(f'dist/{NAME}.json')
    archive = read(f'docs/{NAME}-verification.json')
    assert archive['passed'] and archive['checkedFiles'] == 51 and archive['archiveEntries'] == 52
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as zipped:
        assert zipped.testzip() is None
        for name, entry in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) == entry['sha256']
            assert hashlib.sha256(zipped.read('tidelands-local/' + name)).hexdigest() == entry['sha256']
            assert hashlib.sha256((Path(archive['extractedPath']) / name).read_bytes()).hexdigest() == entry['sha256']
    tests = (ROOT / 'docs/grounding-budget-night-tests.txt').read_text()
    assert '# tests 234\n' in tests and '# pass 234\n' in tests and '# fail 0\n' in tests
    assert 'Ran 4 tests' in (ROOT / 'docs/night-palette-package-tests.txt').read_text()
    backup = read('docs/grounding-budget-night-backup-audit.json')
    assert backup['passed'] and backup['allFieldsPreserved'] and backup['quest'] == 6 and backup['kills'] == 3
    assert backup['sha256'] == sha('docs/grounding-budget-night-normal-save.json')
    ui = read('docs/grounding-budget-night-package-ui.json')
    assert ui['origin'] == 'http://127.0.0.1:53942' and not ui['console']
    coordinates = {}
    for label in ['before', 'after', 'mobileHud', 'secondHud']:
        text = ui[label]
        assert '群岛，再次相连' in text and 'progress indicator Value: 79, ID: hp' in text
        coords = re.search(r'位置 X ([\d.-]+)，Z ([\d.-]+)；建筑 1；击败 3', text)
        assert coords, label
        coordinates[label] = [float(n) for n in coords.groups()]
    assert coordinates['before'] != coordinates['after'] == coordinates['mobileHud'] == coordinates['secondHud']
    assert coordinates['after'] == [round(backup['player']['x'], 1), round(backup['player']['z'], 1)]
    for label in ['desktopBag', 'mobileBag', 'secondBag']:
        for item, count in [('木材', 4), ('石料', 5), ('纤维', 6), ('浆果', 3), ('晶石', 0), ('石斧', 1)]:
            assert re.search(rf'text {item}\n\s+\d+ text {count}(?:\n|$)', ui[label]), (label, item)
    gpu, evidence = {}, ['docs/grounding-budget-night-package-ui.json', 'docs/grounding-budget-night-backup-audit.json', 'docs/grounding-budget-night-normal-save.json', 'docs/grounding-budget-night-tests.txt', 'docs/night-palette-audit.json', 'tests/quality-gpu.html']
    for device, viewport in [('desktop', [1920, 1080]), ('mobile', [390, 844])]:
        name = f'docs/grounding-budget-night-gpu-{device}.json'
        data = read(name)
        sample = data['sample']
        assert sample['complete'] and sample['supported'] and not sample['hidden'] and sample['disjointCount'] == 0 and not data['console']
        assert sample['viewport'] == sample['canvasBuffer'] == viewport and len(sample['rows']) == 5
        assert all(r['gpuMs']['samples'] == 60 and len(r['gpuRawMs']) == 60 and r['gpuMs']['p95'] < 16.67 for r in sample['rows'])
        gpu[device] = [r['gpuMs']['p95'] for r in sample['rows']]
        evidence.append(name)
    assert sha('docs/island-spaces-normal-save.json') == 'e750698e0f888933e089bf8b0e76ebd9890c36d9bd8fcc1b3f5188f80709439c'
    images = [f'docs/grounding-budget-night-normal-{label}.png' for label in ['desktop', 'mobile', 'world']]
    report = {'passed': True, 'boundedBatchDelivered': True, 'archive': package['archive'], 'archiveSha256': package['archiveSha256'],
              'runtimeFiles': 51, 'extractedPath': archive['extractedPath'], 'fullTests': 234, 'packageTests': 4,
              'ordinaryNativeMove': ui['nativeMove'], 'ordinaryCoordinates': coordinates, 'ordinaryBackup': backup,
              'ordinaryRestoresStable': True, 'gpuP95Ms': gpu, 'currentImagesReviewed': images,
              'sourceSha256': {name: entry['sha256'] for name, entry in package['files'].items()},
              'evidenceSha256': {name: sha(name) for name in evidence + images},
              'fullCurrentJourneyReplayed': False, 'currentSourceLongRunAccepted': False, 'audioListened': False,
              'physicalMobileDevice': False, 'm5Complete': False, 'fullGoalComplete': False,
              'limits': 'Independent package launched on existing53942 origin; ordinary native continuation/save/download and390/two restores, not from-zero campaign. GPU fixtures use identical runtime sources with phase teleports, no live HUD/audio/VRAM/phone proof. Night hue correction is bounded; dark faces, model naturalness, foot sliding and camera residuals remain. New JSON is exact at export; subsequent no-input time progression is not claimed identical whole-save state.'}
    endurance_name = 'docs/grounding-budget-night-endurance.json'
    if (ROOT / endurance_name).exists():
        endurance = read(endurance_name)
        s = endurance['sample']
        assert endurance['archiveSha256'] == package['archiveSha256'] and not endurance['console']
        assert endurance['harnessSha256'] == sha('tests/quality-endurance.html')
        assert s['complete'] and not s['hidden'] and s['targetMs'] == 600000 and 600000 <= s['activeMs'] < 601000
        assert s['frames'] > 30000 and s['movingFraction'] > .85 and s['respawns'] == 0 and s['p95Ms'] < 20
        assert s['hitCount'] > 0 and s['damageTaken'] > 0 and s['stepAttempts'] == s['stepsScheduled']
        assert len(s['stages']) == 5 and all(p['distance'] > 30 for p in s['stages'])
        assert len(s['checkpoints']) >= 11 and all(c['glError'] == 0 and c['audio']['voices'] <= 12 and c['viewport'] == [1920, 1080] and c['canvasBuffer'] == [1920, 928] for c in s['checkpoints'])
        assert all(c['heapBytes'] is not None and c['heapBytes'] > 0 for c in s['checkpoints'])
        report['currentSourceLongRunAccepted'] = True
        report['endurance'] = {key: s[key] for key in ['activeMs', 'frames', 'movingFraction', 'distanceMeters', 'hitCount', 'damageTaken', 'respawns', 'p95Ms', 'maxMs', 'over50Ms']}
        report['endurance']['heapMiB'] = [round(c['heapBytes'] / 1048576, 2) for c in s['checkpoints']]
        report['endurance']['limits'] = '600s scripted teleports/weapon/food/revived enemy fixtures; no native campaign or VRAM/leak-freedom/audio audition claim. Browser performance.memory snapshots may include other diagnostics/contexts.'
        paths = [endurance_name, 'tests/quality-endurance.html'] + [f'docs/grounding-budget-night-endurance-phase-{i}.png' for i in range(5)]
        report['currentImagesReviewed'] += paths[2:]
        report['evidenceSha256'].update({name: sha(name) for name in paths})
    (ROOT / 'docs/grounding-budget-night-delivery-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ['evidenceSha256', 'sourceSha256', 'currentImagesReviewed']}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
