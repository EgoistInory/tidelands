"""Replay the bounded weather batch audit from saved UI evidence and package hashes."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
NAME = 'tidelands-m5-2026-10-12-weather'


def read(name):
    return json.loads((DOCS / name).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit():
    baseline = read('weather-coordination-baseline-source.json')
    current = {name: sha(ROOT / name) for name in baseline['runtimeSha256']}
    assert {name for name in current if current[name] != baseline['runtimeSha256'][name]} == {'src/world.js', 'src/sky.js', 'src/scene.js'}
    assert sha(ROOT / 'tests/weather-coordination.html') == baseline['harnessSha256']
    for name, expected in baseline['historicalArchives'].items():
        assert sha(ROOT / 'dist' / name) == expected, name
    build = json.loads((ROOT / 'dist' / (NAME + '.json')).read_text())
    archive = ROOT / 'dist' / (NAME + '.zip')
    assert sha(archive) == build['archiveSha256'] and not build['fullGoalComplete']
    with zipfile.ZipFile(archive) as zipped:
        assert zipped.testzip() is None and len(zipped.namelist()) == 41
        for name, entry in build['files'].items():
            data = zipped.read('tidelands-local/' + name)
            assert hashlib.sha256(data).hexdigest() == entry['sha256']
            if name != 'README.md':
                assert sha(ROOT / name) == entry['sha256'], name
    for name, count in [('focused', 6), ('full', 147)]:
        log = (DOCS / ('weather-coordination-' + name + '-tests.txt')).read_text()
        assert re.search(rf'^# pass {count}$', log, re.M) and re.search(r'^# fail 0$', log, re.M)
    assert 'Ran 4 tests' in (DOCS / 'weather-coordination-package-tests.txt').read_text()
    before = read('weather-coordination-baseline-ui.json')['samples']
    after = read('weather-coordination-after-ui.json')
    assert len(before) == len(after['samples']) == 7 and not after['console']
    for old, new in zip(before, after['samples']):
        a, b = old['report'], new['report']
        assert a['site'] == b['site'] and a['worldTime'] == b['worldTime']
        assert a['memory'] == b['memory'] and a['programs'] == b['programs']
        assert a['render']['calls'] == b['render']['calls'] and a['render']['triangles'] == b['render']['triangles']
        assert b['water']['fogRange'] == [b['fog']['near'], b['fog']['far']]
        assert b['water']['skyColor'] == b['horizon'] == b['fog']['color']
    clear, transition, overcast, night = [x['report'] for x in after['samples'][:4]]
    assert clear['cloudiness'] < transition['cloudiness'] < overcast['cloudiness']
    assert overcast['sunIntensity'] < clear['sunIntensity'] * .4 and overcast['ambientIntensity'] > clear['ambientIntensity'] * .8
    assert overcast['water']['sunlight'] < clear['water']['sunlight'] * .4
    assert night['ambientIntensity'] > .3 and night['water']['light'] > .1
    mobile = read('weather-coordination-after-mobile.json')
    assert len(mobile['samples']) == 4 and not mobile['console']
    assert all(s['report']['viewport'] == [390, 844] for s in mobile['samples'])
    motion, dynamic = {}, {}
    for size in ('desktop', 'mobile'):
        motion[size] = m = read('weather-motion-' + size + '.json')
        assert m['complete'] and m['elapsedMs'] >= 10000 and not m['hidden']
        assert m['before']['memory'] == m['after']['memory'] and m['before']['programs'] == m['after']['programs']
        dynamic[size] = d = read('weather-dynamic-' + size + '.json')
        assert not d['console'] and d['result']['complete'] and not d['result']['hidden']
        assert d['result']['activeMs'] >= 60000 and len(d['result']['stages']) == 5 and d['result']['hitCount'] > 0
    ordinary = read('weather-package-ui.json')
    assert not ordinary['console'] and ordinary['origin'] == 'http://127.0.0.1:53928'
    steps = {s['step']: s for s in ordinary['steps']}
    assert steps['fresh-bag']['inventory']['木材'] == 0 and steps['fresh-bag']['inventory']['石料'] == 0
    assert steps['desktop-gather-bag']['inventory']['石料'] == 2
    assert steps['desktop-reloaded-bag']['inventory']['石料'] == 2
    assert steps['mobile-gather-bag']['inventory']['木材'] == 2
    final = steps['mobile-reloaded-bag']
    assert final['inventory']['石料'] == final['inventory']['木材'] == 2
    assert '荒野的第一把工具' in final['worldAx'] and final['hp'] == '100'
    assert steps['mobile-saved']['position'] == final['position']
    assert ordinary['mobileViewport']['width'] == ordinary['mobileViewport']['scrollWidth'] == 390
    images = sorted(DOCS.glob('weather-*.jpg'))
    assert len(images) >= 13
    for p in images:
        assert p.read_bytes().startswith(b'\xff\xd8'), p
    evidence = sorted(set(DOCS.glob('weather-*.json')) | set(DOCS.glob('weather-*.jpg')) | set(DOCS.glob('weather-coordination-*-tests.txt')))
    evidence = [p for p in evidence if p.name not in ('weather-coordination-final-audit.json', 'weather-coordination-review.json', 'weather-coordination-checkpoint.json')]
    report = {
        'kind': 'bounded-weather-evidence-audit', 'passed': True, 'fullGoalComplete': False,
        'milestoneM5Complete': False, 'pendingBatchEvidence': [], 'runtimeSha256': current,
        'archive': {k: build[k] for k in ('archive', 'archiveBytes', 'archiveEntries', 'archiveSha256')},
        'historicalArchivesPreserved': len(baseline['historicalArchives']),
        'evidenceSha256': {str(p.relative_to(ROOT)): sha(p) for p in evidence},
        'motion': {s: {k: motion[s][k] for k in ('frames', 'p95Ms', 'maxMs', 'over50Ms')} for s in motion},
        'dynamic': {s: {k: dynamic[s]['result'][k] for k in ('activeMs', 'frames', 'p95Ms', 'maxMs', 'over50Ms', 'distanceMeters', 'hitCount')} for s in dynamic},
        'ordinaryFinal': {'position': final['position'], 'inventory': final['inventory'], 'hp': final['hp']},
        'limits': ['No rain or weather-driven wind/waves/vegetation/audio yet', 'Fixed QA camera clips the character at the 390 right edge; composition not accepted', 'One-minute scripted fixtures and two-render fixed camera samples are not a full campaign, GPU, physical-device or long-term memory gate', 'Character, vegetation and overall material quality still show prototype gaps', 'Existing public origin push remains pending the prior destination question; no new request or push'],
    }
    (DOCS / 'weather-coordination-final-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': True, 'fullGoalComplete': False, 'historicalArchivesPreserved': report['historicalArchivesPreserved'], 'archiveSha256': build['archiveSha256']}, ensure_ascii=False))
    return report


if __name__ == '__main__':
    audit()
