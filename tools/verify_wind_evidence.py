"""Replay the limited wind batch using saved rendered UI, scheduling and package evidence."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
NAME = 'tidelands-m5-2026-10-12-wind'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def read(name):
    return json.loads((DOCS / name).read_text())


def audit():
    base = read('weather-wind-baseline-source.json')
    current = {n: sha(ROOT / n) for n in base['runtimeSha256']}
    assert {n for n in current if current[n] != base['runtimeSha256'][n]} == {'src/world.js', 'src/scene.js', 'src/audio.js', 'src/foliage.js', 'src/meadow.js'}
    assert sha(ROOT / 'tests/weather-wind.html') == base['harnessSha256']
    for n, expected in base['historicalArchives'].items():
        assert sha(ROOT / 'dist' / n) == expected, n
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    assert not build['fullGoalComplete'] and sha(ROOT / 'dist' / (NAME + '.zip')) == build['archiveSha256']
    with zipfile.ZipFile(ROOT / 'dist' / (NAME + '.zip')) as z:
        assert len(z.namelist()) == 41 and z.testzip() is None
        for n, entry in build['files'].items():
            assert hashlib.sha256(z.read('tidelands-local/' + n)).hexdigest() == entry['sha256']
            if n != 'README.md':
                assert sha(ROOT / n) == entry['sha256'], n
    for kind, count in [('focused', 36), ('full', 151)]:
        log = (DOCS / ('weather-wind-' + kind + '-tests.txt')).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert 'Ran 4 tests' in (DOCS / 'weather-wind-package-tests.txt').read_text()
    before = read('weather-wind-baseline-ui.json')['samples']
    after = read('weather-wind-after-ui.json'); assert not after['console']
    samples = after['samples']
    for old, index in zip(before, [0, 2, 4, 5]):
        a, b = old['report'], samples[index]['report']
        assert a['site'] == b['site'] and a['worldTime'] == b['worldTime']
        assert a['memory'] == b['memory'] and a['programs'] == b['programs']
        factor = .4 if old['label'] == '晴日' else 1
        assert b['wind']['water'] == factor
        for kind in ('leaf', 'meadow'):
            assert b['wind'][kind] and all(v == factor for v in b['wind'][kind])
        for kind in ('wind', 'surf'):
            assert abs(b['audio']['targets'][kind] - a['audio']['targets'][kind] * factor) < 1e-8
    assert samples[-2]['report']['audio']['active'] is False and samples[-2]['report']['audio']['targets']['master'] == 0
    assert samples[-1]['report']['audio']['active'] is True and samples[-1]['report']['audio']['targets']['master'] == .35
    mobile = read('weather-wind-mobile-ui.json'); assert not mobile['console']
    assert all(s['report']['viewport'] == [390, 844] for s in mobile['samples'])
    motion = {}
    for size in ('desktop', 'mobile'):
        motion[size] = m = read('weather-wind-motion-' + size + '.json')
        assert m['complete'] and m['elapsedMs'] >= 10000 and not m['hidden']
        assert m['before']['memory'] == m['after']['memory'] and m['before']['programs'] == m['after']['programs']
    dynamic = read('weather-wind-dynamic-desktop.json'); d = dynamic['result']
    assert not dynamic['console'] and d['complete'] and not d['hidden'] and d['activeMs'] >= 60000 and len(d['stages']) == 5
    ordinary = read('weather-wind-package-ui.json'); steps = {s['step']: s for s in ordinary['steps']}
    assert ordinary['origin'] == 'http://127.0.0.1:53929' and not ordinary['console']
    assert steps['fresh-bag']['inventory']['石料'] == steps['fresh-bag']['inventory']['木材'] == 0
    assert steps['desktop-reloaded-bag']['inventory']['石料'] == 2
    final = steps['mobile-reloaded-bag']; assert final['inventory']['木材'] == final['inventory']['石料'] == 2
    assert final['hp'] == '100' and '荒野的第一把工具' in final['worldAx']
    assert final['position'] == steps['mobile-saved']['position']
    assert ordinary['mobileViewport']['width'] == ordinary['mobileViewport']['scrollWidth'] == 390
    evidence = sorted(set(DOCS.glob('weather-wind-*.json')) | set(DOCS.glob('weather-wind-*-tests.txt')) | set(DOCS.glob('wind-*.jpg')))
    evidence = [p for p in evidence if p.name not in ('weather-wind-final-audit.json', 'weather-wind-review.json', 'weather-wind-checkpoint.json')]
    report = {'kind': 'bounded-wind-evidence-audit', 'passed': True, 'fullGoalComplete': False, 'milestoneM5Complete': False, 'pendingBatchEvidence': [],
              'runtimeSha256': current, 'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
              'historicalArchivesPreserved': len(base['historicalArchives']), 'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for p in evidence},
              'motion': {s: {k: motion[s][k] for k in ('frames', 'p95Ms', 'maxMs', 'over50Ms')} for s in motion},
              'dynamicDesktop': {k: d[k] for k in ('frames', 'activeMs', 'p95Ms', 'maxMs', 'over50Ms', 'distanceMeters', 'hitCount')},
              'ordinaryFinal': {'position': final['position'], 'inventory': final['inventory'], 'hp': final['hp']},
              'limits': ['Real WebAudio scheduling targets and fade restoration, not actual listening or audio quality acceptance', 'Two-render fixed review camera and scripted five-stage one-minute load, not GPU/VRAM/physical-device/long-term or full campaign acceptance', 'Simple waves and vegetation, no physical storm or rain', 'Character and vegetation still retain prototype art gaps; mobile fixed QA camera clips right edge', 'Public origin destination question unchanged; no push or repeated question']}
    (DOCS / 'weather-wind-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': True, 'fullGoalComplete': False, 'archiveSha256': build['archiveSha256'], 'historicalArchivesPreserved': len(base['historicalArchives'])}))
    return report


if __name__ == '__main__':
    audit()
