"""Audit saved controlled-browser evidence for the bounded startup batch."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-11-startup'


def read(name):
    return json.loads((ROOT / 'docs' / name).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def uploads(trace):
    return [event for event in trace['events'] if event['kind'] == 'upload']


def check_ready(trace, count):
    items = uploads(trace)
    first = next(event for event in trace['events'] if event['kind'] == 'draw')
    assert len(items) == count
    assert len({item['frame'] for item in items}) == count
    assert len({item['source'] for item in items}) == count
    assert all(item['phase'] == 'loading' and item['frame'] < first['frame'] for item in items)
    assert first['enabled'] is False and trace['button']['disabled'] is False
    return {'uploads': count, 'maxUploadCpuMs': round(max((item['cpuMs'] for item in items), default=0), 2),
            'firstDrawCpuMs': round(first['cpuMs'], 2), 'firstDrawBeforeStartEnabled': True}


def inventory(ax, name, amount):
    assert re.search(r'text ' + re.escape(name) + r'\n\s+\d+ text ' + str(amount) + r'\n', ax), (name, amount)


def coordinates(ax):
    result = re.search(r'位置 X (-?[\d.]+)，Z (-?[\d.]+)；建筑 (\d+)；击败 (\d+)', ax)
    assert result, 'Missing displayed coordinates'
    return result.group(0)


def verify():
    sources = read('startup-preparation-source.json')['files']
    assert all(sha(ROOT / path) == digest for path, digest in sources.items()), 'Source changed after browser acceptance'
    rows = {row['mode']: row for row in read('startup-preparation-browser.json')}
    assert set(rows) == {'normal', 'fallback', 'all-fallback', 'cancel', 'restore', 'upload-error'}
    ready = {}
    for mode, count in [('normal', 9), ('fallback', 6), ('all-fallback', 0)]:
        row = rows[mode]
        ready[mode] = check_ready(row['trace'], count)
        assert row['entered'] is True
        if mode != 'normal':
            assert '备用素材' in row['trace']['status']
            assert len(row['console']) == (1 if mode == 'fallback' else 3)
            assert all(item['level'] == 'warn' and '贴图加载失败' in item['message'] for item in row['console'])
        else:
            assert row['console'] == []
    assert not any('/coastal-sand/' in item['source'] for item in uploads(rows['fallback']['trace']))
    for mode in ['cancel', 'restore', 'upload-error']:
        assert rows[mode]['trace']['draws'] == 0
        assert rows[mode]['entered'] is False
    assert uploads(rows['cancel']['trace']) == [] and '画面暂时中断' in rows['cancel']['ax']
    assert '导出存档备份' in rows['cancel']['ax'] and '进度已保存' in rows['cancel']['ax']
    assert rows['cancel']['trace']['button']['disabled'] is True
    assert uploads(rows['restore']['trace']) == [] and '准备已中断' in rows['restore']['trace']['status']
    for mode in ['restore', 'upload-error']:
        assert rows[mode]['trace']['button'] == {'disabled': False, 'text': '重新加载'}
    assert len(uploads(rows['upload-error']['trace'])) == 1
    assert any('WebGL 1282' in item['message'] for item in rows['upload-error']['console'])
    mobile = read('startup-preparation-mobile-ready.json')
    ready['mobile'] = check_ready(mobile['trace'], 9)
    assert mobile['trace']['viewport'] == [390, 844] and mobile['entered'] and not mobile['console']
    frames = {}
    for viewport in ['desktop', 'mobile']:
        record = read('startup-preparation-' + viewport + '-frames.json')
        assert record['complete'] and record['activeMs'] >= record['targetMs'] == 30000
        assert record['hidden'] is False and record['console'] == []
        frames[viewport] = {key: record[key] for key in ['activeMs', 'frames', 'p95Ms', 'maxMs', 'over50Ms', 'viewport', 'canvasBuffer', 'scope']}
    desktop = read('startup-preparation-package-desktop.json')
    phone = read('startup-preparation-package-mobile.json')
    assert not desktop['fixtureImport'] and not phone['fixtureImport']
    inventory(desktop['initialBag'], '石料', 0)
    inventory(desktop['afterBag'], '石料', 2)
    inventory(desktop['reloadBag'], '石料', 2)
    assert '存档已保存' in desktop['saved']
    assert coordinates(desktop['collected']) == coordinates(desktop['reload'])
    assert '木材 +2' in phone['gathered'] and '存档已保存' in phone['saved']
    assert 'E交谈 · 阿岚' in phone['npc'] and '荒野的第一把工具' in phone['reload']
    for name, amount in [('木材', 2), ('石料', 2), ('浆果', 3)]:
        inventory(phone['bag'], name, amount)
    assert phone['dom']['viewport'] == [390, 844] and phone['dom']['scrollWidth'] <= 390
    assert 'progress indicator Value: 100, ID: hp' in phone['reload']
    assert not desktop['console'] and not phone['console']
    assert '# pass 144\n' in (ROOT / 'docs/startup-textures-full-tests.txt').read_text()
    assert '# fail 0\n' in (ROOT / 'docs/startup-textures-full-tests.txt').read_text()
    assert 'Ran 4 tests' in (ROOT / 'docs/startup-preparation-package-tests.txt').read_text()
    package = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    assert package['fullGoalComplete'] is False and package['archiveEntries'] == 41 and len(package['files']) == 40
    assert sha(ROOT / 'dist' / package['archive']) == package['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / package['archive']) as archive:
        assert archive.testzip() is None
        for path, item in package['files'].items():
            source = ROOT / ('docs/LOCAL-DELIVERY.md' if path == 'README.md' else path)
            assert sha(source) == item['sha256'], path
            assert hashlib.sha256(archive.read('tidelands-local/' + path)).hexdigest() == item['sha256'], path
    historical = {}
    for archive in sorted((ROOT / 'dist').glob('*.zip')):
        if archive.name != package['archive']:
            manifest = json.loads(archive.with_suffix('.json').read_text())
            assert sha(archive) == manifest['archiveSha256'], archive.name
            historical[archive.name] = manifest['archiveSha256']
    assert len(historical) == 18
    m5 = (ROOT / 'ROADMAP.md').read_text().split('### M5', 1)[1].split('最终目标未完成前', 1)[0]
    assert m5.count('- [ ]') == 5 and '- [x]' not in m5
    listener = subprocess.run(['lsof', '-nP', '-iTCP:53927', '-sTCP:LISTEN'], capture_output=True, text=True)
    assert listener.returncode == 1 and not listener.stdout, 'Extracted-package server still running'
    evidence_paths = sorted(path for path in (ROOT / 'docs').glob('startup-*')
                            if path.is_file() and path.name not in ('startup-preparation-final-audit.json', 'startup-preparation-review.json', 'startup-preparation-checkpoint.json'))
    report = {'kind': 'bounded-startup-evidence-audit', 'passed': True, 'fullGoalComplete': False, 'm5Complete': False,
              'pendingBatchEvidence': [], 'verifierSha256': sha(Path(__file__)),
              'sourceSha256': sources, 'ready': ready, 'frames': frames,
              'ordinaryPackage': {'desktopResource': '石料 0→2', 'mobileResource': '木材 0→2',
                                  'mobileFinalCoordinates': coordinates(phone['reload']), 'saveReload': True,
                                  'firstNpc': True, 'fixtureImport': False, 'console': []},
              'package': {key: package[key] for key in ['archive', 'archiveBytes', 'archiveSha256', 'archiveEntries']},
              'historicalArchives': historical, 'extractedServerStopped': True,
              'evidenceSha256': {str(path.relative_to(ROOT)): sha(path) for path in evidence_paths},
              'limits': ['Uploads were moved before play; total cold cost and shader compilation still remain.',
                         'Restore test dispatches synthetic lifecycle events; not actual browser bfcache proof.',
                         'Thirty-second stationary RAF samples are not GPU, long-term memory or full gameplay performance.',
                         '390px Mac browser is not physical phone or multitouch acceptance.',
                         'Ordinary package smoke covers first NPC, gathering and saves; not full campaign rerun.',
                         'Native GL flags and thrown upload errors are checked; not every driver failure is observable.']}
    (ROOT / 'docs/startup-preparation-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': True, 'readyModes': len(ready), 'nodeTests': 144, 'historicalArchives': len(historical),
                      'packageSha256': package['archiveSha256'], 'fullGoalComplete': False}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    verify()
