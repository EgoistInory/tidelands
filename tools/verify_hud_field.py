"""Audit the bounded CSS HUD delivery against retained browser and archive evidence."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-24-hud-field'
BASE = '01bd719ae255c1a5284e640a0a75acb8a37cc7e0'
load = lambda p: json.loads((ROOT / p).read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def verify():
    p = load('dist/' + NAME + '.json')
    old = load('dist/tidelands-m5-2026-10-24-camp-sound.json')
    unpack = load('docs/' + NAME + '-verification.json')
    assert p['archiveBytes'] == 15063660 and p['archiveEntries'] == 95 and len(p['files']) == 94
    archive_path = ROOT / 'dist' / p['archive']
    assert archive_path.stat().st_size == p['archiveBytes']
    assert sha(archive_path) == p['archiveSha256'] == unpack['archiveSha256']
    assert p['archiveSha256'] == 'f5fdcb4950a778bdf8c04d4eb3b2ca8efb8b33641146110af6665465c179db7b'
    assert unpack['passed'] and unpack['checkedFiles'] == 94
    assert sha(ROOT / 'dist' / old['archive']) == old['archiveSha256']
    assert p['builderSha256'] == old['builderSha256'] == sha(ROOT / 'tools/package_local.py')
    assert p['files'].keys() == old['files'].keys()
    changed = [n for n, r in p['files'].items() if r['sha256'] != old['files'][n]['sha256']]
    assert changed == ['README.md', 'styles.css']
    with zipfile.ZipFile(archive_path) as archive:
        assert len(archive.infolist()) == 95 and archive.testzip() is None
        for n, row in p['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if n == 'README.md' else n)
            assert sha(source) == sha(Path(unpack['extractedPath']) / n) == row['sha256'], n
            assert hashlib.sha256(archive.read('tidelands-local/' + n)).hexdigest() == row['sha256'], n
    # Historical rule tests are retained, not reported as a new test run for CSS.
    assert not subprocess.check_output(['git', 'diff', BASE, '--', 'src', 'tests/*.test.js'], cwd=ROOT)
    old_tests = (ROOT / 'docs/camp-sound-full-tests.txt').read_text()
    assert '# tests 310\n' in old_tests and '# fail 0\n' in old_tests
    evidence = load('docs/hud-field-browser.json')
    assert evidence['console'] == [] and evidence['rejected'] == ['combat-candidate']
    rows = {r['name']: r for r in evidence['rows']}
    assert len(rows) == len(evidence['rows']) == 9
    for name, row in rows.items():
        assert row['glError'] == 0 and row['frames'] > 0
        for n, digest in row['sources'].items():
            if n != 'styles.css':
                assert sha(ROOT / n) == digest, (name, n)
        if name.endswith('-baseline'):
            assert row['sources']['styles.css'] == old['files']['styles.css']['sha256']
        elif name.endswith('-final'):
            assert row['sources']['styles.css'] == p['files']['styles.css']['sha256']
            w, h = row['viewport']
            bw, bh = row['buffer']
            assert abs(bw / bh - w / h) < 0.00001
            for selector, box in row['rects'].items():
                if box['visible']:
                    assert box['scrollWidth'] <= box['clientWidth'] + 1, (name, selector)
                    assert box['x'] >= 0 and box['y'] >= 0 and box['right'] <= w + 1 and box['bottom'] <= h + 1, (name, selector)
    for prefix in ['desktop', 'portrait', 'combat']:
        before, after = rows[prefix + '-baseline'], rows[prefix + '-final']
        for key in ['mode', 'quest', 'position', 'camera', 'viewport', 'buffer']:
            assert before[key] == after[key], (prefix, key)
        assert before['rects']['.quest']['text'] == after['rects']['.quest']['text']
    assert rows['desktop-final']['viewport'] == [1280, 720]
    assert rows['portrait-final']['viewport'] == [390, 844]
    assert rows['landscape-final']['viewport'] == [844, 390]
    assert rows['narrow-final']['viewport'] == [320, 740]
    assert rows['desktop-final']['rects']['.quest']['bottom'] == 293 < 343
    assert rows['portrait-final']['rects']['.quest']['bottom'] == 206.84375 < 242.5
    rejected = rows['combat-candidate']['rects']
    assert rejected['#enemy-status']['y'] == 118 < rejected['.vitals']['bottom']
    combat = rows['combat-final']['rects']
    assert combat['#enemy-status']['y'] == 128 > combat['.vitals']['bottom']
    assert combat['#enemy-status']['bottom'] == 196 and not combat['.quest']['visible']
    for name in ['portrait-final', 'landscape-final', 'narrow-final']:
        text = rows[name]['rects']['.quest']['text']
        assert all(s in text for s in ['归航的灯火', '与海边的守灯人交谈', '靠近人物，按 E 交谈 · 14 米'])
    assert [(r['name'], r['title']) for r in evidence['controls']] == [
        ('map', '群岛地图'), ('bag', '旅人的背包'), ('craft', '制作与建造'), ('pause', '旅途小憩')]
    assert evidence['controls'][0]['bounds'] == dict(height=318, width=318)
    assert len(evidence['narrowHitTargets']) == 11
    assert all(r['hit'] and r['visible'] and min(r['width'], r['height']) >= 44 for r in evidence['narrowHitTargets'])
    ordinary = load('docs/hud-field-package-browser.json')
    assert ordinary['console'] == [] and 'progress indicator Value: 79, ID: hp' in ordinary['ax']
    assert '群岛，再次相连' in ordinary['ax'] and '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ordinary['ax']
    for item, count in [('木材', 4), ('石料', 5), ('纤维', 6), ('浆果', 3), ('贝壳', 0), ('晶石', 0), ('石斧', 1), ('晶石剑', 0), ('烤浆果', 0)]:
        assert re.search(r'text ' + item + r'\n\s+\d+ text ' + str(count) + r'\n', ordinary['bagAx'])
    assert sha(ROOT / 'docs/beacon-footing-normal-save.json') == '33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    images = sorted((ROOT / 'docs').glob('hud-field-*.jpg'))
    assert len(images) == 10 and all(n.read_bytes()[:2] == b'\xff\xd8' for n in images)
    selectors = ['.vitals', '.quest', '.map-corner', '.hotbar', '#enemy-status', '.bottom-right', '#joystick', '#attack-button']
    coverage = {}
    for name, row in rows.items():
        area = sum(row['rects'][s]['width'] * row['rects'][s]['height'] for s in selectors if row['rects'][s]['visible'])
        coverage[name] = dict(widgetRectangleArea=round(area, 2), viewportPercent=round(area / (row['viewport'][0] * row['viewport'][1]) * 100, 2))
    files = [*sorted((ROOT / 'docs').glob('hud-field-*')), ROOT / 'tests/hud-field-review.html',
             ROOT / 'tools/verify_hud_field.py', ROOT / 'docs/HUD-FIELD-PLAN.md', ROOT / 'docs/HUD-FIELD-DELIVERY.md',
             ROOT / ('docs/' + NAME + '-verification.json')]
    files = [n for n in files if n.name != 'hud-field-audit.json']
    report = dict(verified=True, boundedHudFieldDelivered=True, archive=p['archive'], archiveSha256=p['archiveSha256'],
                  archiveBytes=p['archiveBytes'], changedInputs=changed, runtimeInputs=94, extractedPath=unpack['extractedPath'],
                  newRuleTestRun=False, historicalFullTests=310, historicalTestCommit=BASE, javascriptAndRuleTestsUnchanged=True,
                  imagesViewed=10, rejectedImages=1, fixtureRows=9, narrowTargets=11, coverage=coverage,
                  ordinaryDesktopRestored=True, ordinary390ReloadRestored=False, newManualSaveVerified=False, ordinaryNewJsonExported=False,
                  currentExactSourceGpuAccepted=False, currentExactSourceEnduranceAccepted=False, physicalTouchDeviceVerified=False,
                  milestoneM5Complete=False, fullGoalComplete=False,
                  scope='CSS layout and complete text, native modal controls, DOM hit targets and independent-package ordinary desktop continue. Fixture times/HP/poses differ; rectangle area is not opaque pixels, camera field of view or final visual quality.',
                  files={str(n.relative_to(ROOT)): sha(n) for n in files})
    (ROOT / 'docs/hud-field-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['verified', 'boundedHudFieldDelivered', 'archiveSha256', 'fullGoalComplete']}))


if __name__ == '__main__':
    verify()
