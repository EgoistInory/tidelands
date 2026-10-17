"""Capture finite candidate frame budgets without claiming long-run quality."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def verify():
    candidate = json.loads((ROOT / 'docs/creature-grounding-candidate.json').read_text())
    for name, digest in candidate['changedRuntime'].items():
        assert sha(name) == digest
    paths, summary = [], {}
    for device, viewport, buffer in [('desktop', [1920, 1080], [2880, 1392]), ('mobile', [390, 844], [585, 930])]:
        name = f'docs/creature-grounding-load-{device}.json'
        data = json.loads((ROOT / name).read_text())
        s = data['sample']
        assert s['complete'] and not s['hidden'] and not data['console']
        assert s['targetMs'] == 60000 and 60000 <= s['activeMs'] < 61000
        assert len(s['stages']) == 5 and all(p['distance'] > 30 for p in s['stages'])
        assert s['movingFraction'] > .85 and s['respawns'] == 0 and s['hitCount'] > 0 and s['damageTaken'] > 0
        assert s['stepAttempts'] == s['stepsScheduled']
        assert all(c['viewport'] == viewport and c['canvasBuffer'] == buffer and c['glError'] == 0 and c['audio']['voices'] <= 12 for c in s['checkpoints'])
        summary[device] = {k: s[k] for k in ['activeMs', 'frames', 'movingFraction', 'hitCount', 'damageTaken', 'respawns', 'p95Ms', 'maxMs', 'over50Ms']}
        summary[device].update(viewport=viewport, canvasBuffer=buffer, p95Within20ms=s['p95Ms'] <= 20)
        paths += [name] + data['images']
    wrong = json.loads((ROOT / 'docs/creature-grounding-load-wrong-viewport.json').read_text())
    assert wrong['sample']['checkpoints'][-1]['viewport'] == [1280, 720] and wrong['rejection']
    paths += ['docs/creature-grounding-load-wrong-viewport.json', 'docs/creature-grounding-load-wrong-viewport.png', 'tests/quality-endurance.html']
    report = {
        'metricsCaptured': True, 'allFrameBudgetsMet': all(s['p95Within20ms'] for s in summary.values()),
        'samples': summary, 'changedRuntime': candidate['changedRuntime'],
        'evidenceSha256': {p: sha(p) for p in paths},
        'fullGoalComplete': False, 'milestoneM5Complete': False,
        'currentSourceLongRunAccepted': False, 'currentSourceGpuAccepted': False,
        'scope': 'Two60s scripted five-phase samples, not600s/native campaign/GPU/real phone/listening. Canvas height excludes diagnostic panel. Initial mobile request actually1280 and rejected; retained. Desktop2880x1392 is2.25 times prior1920x928 pixels, so old17.8ms and current33.4ms are not a controlled regression comparison. High-resolution frame budget remains open; no cause inferred.'
    }
    (ROOT / 'docs/creature-grounding-load-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'evidenceSha256'}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
