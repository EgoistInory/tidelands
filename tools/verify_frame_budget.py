"""Audit the bounded same-canvas experiment and production drawing budget."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text())


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def checked_gpu(name, viewport, buffer):
    data = read(name)
    s = data['sample']
    assert not data['console'] and s['complete'] and s['supported']
    assert not s['hidden'] and s['disjointCount'] == 0
    assert s['viewport'] == viewport and s['canvasBuffer'] == buffer
    assert len(s['rows']) == 5
    for row in s['rows']:
        assert row['gpuMs']['samples'] == 60 and len(row['gpuRawMs']) == 60
        assert all(n > 0 for n in row['gpuRawMs'])
    return s


def verify():
    prepared = read('docs/frame-budget-baseline-prepared.json')
    manifest = read('dist/tidelands-m5-2026-10-16-ecosystem.json')
    assert prepared['baselineFilesMatched'] == 51 and prepared['archiveSha256'] == manifest['archiveSha256']
    assert sha('dist/' + manifest['archive']) == manifest['archiveSha256']
    assert prepared['harnessSha256'] == sha('tests/frame-budget-review.html')
    comparisons, evidence = {}, []
    for ratio, buffer in [('15', [2880, 1620]), ('1', [1920, 1080])]:
        names = [f'docs/frame-budget-{source}-{ratio}.json' for source in ['baseline', 'current']]
        a, b = [checked_gpu(name, [1920, 1080], buffer) for name in names]
        assert a['fixedDt'] == b['fixedDt'] == 1 / 60
        for old, new in zip(a['rows'], b['rows']):
            assert old['phase'] == new['phase'] and old['position'] == new['position']
            assert old['time'] == new['time'] and old['hits'] == new['hits']
        comparisons[ratio] = {source: [r['gpuMs']['p95'] for r in sample['rows']] for source, sample in [('ecosystem', a), ('creatureBeforeCap', b)]}
        evidence += names
    assert max(comparisons['15']['ecosystem']) > 16.67 and max(comparisons['15']['creatureBeforeCap']) > 16.67
    assert max(comparisons['1']['creatureBeforeCap']) < 16.67
    final = {}
    for label, viewport, buffer in [('gpu', [1920, 1080], [1920, 1080]), ('mobile-gpu', [390, 844], [390, 844])]:
        name = f'docs/frame-budget-final-{label}.json'
        sample = checked_gpu(name, viewport, buffer)
        assert all(r['gpuMs']['p95'] < 16.67 and r['rafIntervalMs']['p95'] < 20 for r in sample['rows'])
        final[label] = {'gpuP95Ms': [r['gpuMs']['p95'] for r in sample['rows']], 'pixelRatio': sample['pixelRatio'], 'canvasBuffer': buffer}
        evidence.append(name)
    name = 'docs/frame-budget-final-load.json'
    data = read(name)
    s = data['sample']
    assert not data['console'] and s['complete'] and not s['hidden']
    assert 60000 <= s['activeMs'] < 61000 and s['targetMs'] == 60000
    assert s['p95Ms'] < 20 and s['frames'] > 3000 and s['movingFraction'] > .85 and s['respawns'] == 0
    assert s['hitCount'] > 0 and s['damageTaken'] > 0 and s['stepAttempts'] == s['stepsScheduled']
    assert len(s['stages']) == 5 and all(r['distance'] > 30 for r in s['stages'])
    assert all(c['viewport'] == [1920, 1080] and c['canvasBuffer'] == [1920, 928] and c['glError'] == 0 and c['audio']['voices'] <= 12 for c in s['checkpoints'])
    evidence += [name, 'tests/quality-gpu.html', 'tests/quality-endurance.html', 'docs/frame-budget-baseline-prepared.json']
    for label, count in [('tests', 233), ('focused', 16)]:
        name = f'docs/frame-budget-{label}.txt'
        text = (ROOT / name).read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
        evidence.append(name)
    assert 'high-DPI output allocates2880x1620pixels' in (ROOT / 'docs/frame-budget-red.txt').read_text()
    changed = [name for name, entry in manifest['files'].items() if sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) != entry['sha256']]
    assert set(changed) == {'src/scene.js', 'src/creature.js'}
    assert sha('docs/island-spaces-normal-save.json') == 'e750698e0f888933e089bf8b0e76ebd9890c36d9bd8fcc1b3f5188f80709439c'
    images = ['docs/frame-budget-final-desktop.png', 'docs/frame-budget-final-mobile.png']
    report = {'finiteFrameBudgetAccepted': True, 'fullGoalComplete': False, 'milestoneM5Complete': False,
              'delivered': False, 'currentSourceLongRunAccepted': False,
              'sourceSha256': {name: sha(name) for name in changed}, 'unchangedRuntimeFiles': 49,
              'comparisonGpuP95Ms': comparisons, 'finalGpu': final,
              'finalLoad': {key: s[key] for key in ['activeMs', 'frames', 'movingFraction', 'hitCount', 'damageTaken', 'respawns', 'p95Ms', 'maxMs', 'over50Ms']},
              'evidenceSha256': {name: sha(name) for name in evidence + ['docs/frame-budget-red.txt'] + images},
              'limits': 'QA fixed-dt comparison preserves endpoints; final production GPU fixture uses real rAF dt and no audio/HUD.60s actual tick/render/audio sample excludes HUD/save. Drawing capped at2073600 pixels; high-DPI sharpness tradeoff, no model/detail removal. Final mobile viewport exposes DPR1, buffer390x844; DPR2 mobile1.5ceiling covered by resize unit test, not physical phone. Old ratio1 baseline partly overlapped Node tests and is not an isolated CPU/rAF comparison. No600s/current whole-campaign/phone/VRAM/listening or3A quality acceptance.'}
    (ROOT / 'docs/frame-budget-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'evidenceSha256'}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
