"""Verify island-layer delivery evidence without widening it to full M5 acceptance."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    package = read('dist/tidelands-m5-2026-10-15-environment.json')
    archived = read('docs/tidelands-m5-2026-10-15-environment-verification.json')
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    assert archived['passed'] and archived['checkedFiles'] == 48 and archived['archiveEntries'] == 49
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert archive.testzip() is None
        for name, record in package['files'].items():
            path = 'docs/LOCAL-DELIVERY.md' if name == 'README.md' else name
            assert sha(path) == record['sha256'], path
            assert hashlib.sha256(archive.read('tidelands-local/' + name)).hexdigest() == record['sha256']
            assert hashlib.sha256((Path(archived['extractedPath']) / name).read_bytes()).hexdigest() == record['sha256']
    before = read('docs/environment-before-ui.json')
    final = read('docs/environment-final-ui.json')
    assert len(before) == 6 and len(final['rows']) == 15 and not final['console']
    for row in before + final['rows']:
        assert row['ready'] and row['glError'] == 0
        assert all(row[name] == 'ready' for name in ['ground', 'sand', 'rock'])
    assert {r['region'] for r in final['rows'] if r['clock'] == 0} == {'coast', 'forest', 'highland', 'shoal', 'camp'}
    assert len([r for r in final['rows'] if r['frames'] == 180]) == 2
    assert len([r for r in final['rows'] if r['viewport'] == [390, 844]]) == 2
    normal = read('docs/environment-package-ui.json')
    assert not normal['console'] and len(normal['rows']) == 3
    hud = [r['hud'] for r in normal['rows']]
    assert all(h['quest'] == '群岛，再次相连' and h['hp'] == '100' for h in hud)
    assert hud[0]['coordinates'] != hud[1]['coordinates']
    assert hud[0]['inventory'] == hud[2]['inventory']
    assert hud[2]['viewport'] == [390, 844] and hud[2]['scrollWidth'] == 390
    raw = read('docs/environment-normal-save.json')
    assert raw['quest'] == 6 and raw['kills'] == 2 and len(raw['buildings']) == 1 and raw['player']['hp'] == 100
    assert raw['inventory'] == read('docs/resource-contact-normal-save.json')['inventory']
    coords = tuple(map(float, re.search(r'X (-?[\d.]+)，Z (-?[\d.]+)', hud[2]['coordinates']).groups()))
    assert coords == (round(raw['player']['x'], 1), round(raw['player']['z'], 1))
    result = subprocess.run(['node', '--input-type=module', '-e', "import {restore} from './src/game.js';import {readFileSync} from 'node:fs';console.log(JSON.stringify(restore(readFileSync('docs/environment-normal-save.json','utf8'))));"], cwd=ROOT, check=True, capture_output=True, text=True)
    restored = json.loads(result.stdout)
    for key in ['player', 'quest', 'inventory', 'buildings', 'kills']:
        assert restored[key] == raw[key], key
    for suffix, count in [('focused', 17), ('full', 198)]:
        output = (ROOT / f'docs/environment-{suffix}.txt').read_text()
        assert f'# tests {count}\n' in output and f'# pass {count}\n' in output and '# fail 0\n' in output
    assert 'ERR_MODULE_NOT_FOUND' in (ROOT / 'docs/environment-red.txt').read_text()
    assert sha('docs/resource-contact-normal-save.json') == 'f0aec7080fd1e63b6c81d25b3c3e251420b6240fa4b4158949e733e9816a4649'
    assert sha('docs/current-journey-final-camp-save.json') == '0dc650a3ac8a83b62ea3e33c8797607f50d7f60b49b9a07e941e9040a196655e'
    old = read('dist/tidelands-m5-2026-10-14-resource-contact.json')
    assert sha('dist/' + old['archive']) == old['archiveSha256']
    for name in ['src/game.js', 'src/world.js', 'src/camera.js', 'src/resource-contact.js']:
        assert sha(name) == old['files'][name]['sha256'], name
    images = sorted((ROOT / 'docs').glob('environment-final-*.png')) + sorted((ROOT / 'docs').glob('environment-package-*.png'))
    assert len(images) == 18
    inputs = ['src/landscape.js', 'src/scene.js', 'src/ground-surface.js', 'src/meadow.js', 'src/rock-surface.js', 'tests/landscape.test.js', 'tests/ground-surface.test.js', 'tests/weather.test.js', 'tests/environment-review.html', 'docs/environment-before-ui.json', 'docs/environment-initial-ui.json', 'docs/environment-final-ui.json', 'docs/environment-package-ui.json', 'docs/environment-normal-save.json', 'docs/environment-focused.txt', 'docs/environment-full.txt', 'docs/environment-red.txt']
    report = {
        'passed': True, 'kind': 'island-surface-and-shoreline-batch-progress',
        'localDeliveryVerified': True, 'ordinaryCompletedStatePreserved': True,
        'milestoneM5Complete': False, 'fullGoalComplete': False, 'newPackageFullMainPathReplayed': False,
        'package': package['archive'], 'packageSha256': package['archiveSha256'], 'runtimeFiles': 48,
        'unitTests': {'focused': 17, 'full': 198},
        'imagesActuallyViewedSha256': {str(p.relative_to(ROOT)): sha(p.relative_to(ROOT)) for p in images},
        'sourceAndEvidenceSha256': {p: sha(p) for p in inputs},
        'finalSave': {'path': 'docs/environment-normal-save.json', 'bytes': (ROOT / 'docs/environment-normal-save.json').stat().st_size, 'sha256': sha('docs/environment-normal-save.json'), 'player': raw['player'], 'inventory': raw['inventory'], 'quest': 6},
        'limits': ['Visual fixtures explicitly declare positions, camp and no enemies; no browser storage or runtime edits.', '180-frame movement is scripted fixed-dt, not native input or performance evidence.', '390x844 is browser viewport, not real device, touch or GPU evidence.', 'UI before pause may lag raw position by its 140ms refresh; final download matches post-reload visible coordinates.', 'Initial shader directive concatenation failed WebGL compilation and was repaired; final 15 fixture rows and ordinary package console are clear.', 'Resource geometry and save/game/camera rules are unchanged; residual orbit, actor overlap, repeated vegetation/placeholder ruin, listening and final long-run quality remain.'],
    }
    (ROOT / 'docs/environment-progress-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': True, 'runtimeFiles': 48, 'quest': 6, 'fullGoalComplete': False}))


if __name__ == '__main__':
    verify()
