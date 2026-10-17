"""Audit bounded analytic contact shade evidence; no full physical-contact or M5 claim."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = {'src/contact-shade.js': '850e369efa536ffae51afc404734459502362bb05875bb3a510a223dbc9029dc', 'src/scene.js': '079e292b4b3ffefcb700dbdbed57d8d426506eb8033c8e1d159654d6f23f0c00', 'tests/contact-shade.test.js': '6441cc180ee086013f281afbad8d2758d0774f4663cb7128ebf827c5942bf611', 'tests/contact-shade-review.html': 'b17ae01ffdeaa45dfcda6065bfa74c813a4ec4c1c724172155095f18ff2d5101', 'tests/quality-gpu.html': '3881b9a5ac2dfb355a31b1cd49d477a4427879fe48e21ded291c921935c98b9c'}


def sha(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()


def read(name):
    return json.loads((ROOT / name).read_text())


def verify():
    for name, digest in SOURCE_SHA.items():
        assert sha(name) == digest, ('source drift', name)
    for name, count in [('contact-shade-focused.txt', 16), ('contact-shade-tests.txt', 237)]:
        result = (ROOT / 'docs' / name).read_text()
        assert f'# tests {count}\n' in result and f'# pass {count}\n' in result and '# fail 0\n' in result
    assert 'ERR_MODULE_NOT_FOUND' in (ROOT / 'docs/contact-shade-red.txt').read_text()
    before, after = read('docs/contact-shade-before.json'), read('docs/contact-shade-after.json')
    assert not before['console'] and not after['console']
    assert len(before['rows']) == len(after['static']) == 5
    for b, a in zip(before['rows'], after['static']):
        assert [b[k] for k in ['site', 'time', 'player', 'viewport']] == [a[k] for k in ['site', 'time', 'player', 'viewport']]
        assert not b['shadeEnabled'] and a['shadeEnabled'] and b['glError'] == a['glError'] == 0
        assert 0 < a['actorPatches'] <= 32 and a['resourceVertices'] == 13122
    rows = {r['case']: r for r in after['interactions']}
    assert [rows[n]['depleted'] for n in ['mineral-active', 'mineral-depleted', 'mineral-restored']] == [False, True, False]
    assert rows['coast-motion120']['frames'] == 120 and rows['coast-motion120']['player'][1] < 100
    assert rows['mobile-night-camp']['viewport'] == [390, 844] and rows['mobile-night-camp']['campVertices'] == 114
    assert all(r['glError'] == 0 for r in rows.values())
    gpu = {}
    for device, size in [('desktop', [1920, 1080]), ('mobile', [390, 844])]:
        data = read(f'docs/contact-shade-gpu-{device}.json'); s = data['sample']
        assert not data['console'] and s['complete'] and s['supported'] and not s['hidden'] and s['disjointCount'] == 0
        assert s['viewport'] == s['canvasBuffer'] == size and len(s['rows']) == 5
        assert all(r['gpuMs']['samples'] == len(r['gpuRawMs']) == 60 and r['gpuMs']['p95'] < 16.67 for r in s['rows'])
        gpu[device] = {r['phase']: {'gpuP95Ms': r['gpuMs']['p95'], 'cpuP95Ms': r['cpuFrameWorkMs']['p95'], 'rafP95Ms': r['rafIntervalMs']['p95']} for r in s['rows']}
    package = read('dist/tidelands-m5-2026-10-17-grounding-budget-night.json')
    assert sha('dist/' + package['archive']) == package['archiveSha256'] == '23156d79fcac9f7905f730a40fa73cc2fdb76f8b6a2778f2415e24011a53e5ba'
    changed = [name for name, entry in package['files'].items() if sha('docs/LOCAL-DELIVERY.md' if name == 'README.md' else name) != entry['sha256']]
    assert changed == ['src/scene.js'], changed
    assert {str(f.relative_to(ROOT)) for f in (ROOT / 'src').glob('*.js')} - set(package['files']) == {'src/contact-shade.js'}
    assert sha('docs/grounding-budget-night-normal-save.json') == '7a61b0ebbd67a8a9cd8e778b40148dea0d36acbddccb011c78ebfa971d05c4ce'
    images = [f'docs/contact-shade-{version}-{site}-{time}.jpg' for version in ['before', 'after'] for site, time in [('coast', 240), ('forest', 240), ('mineral', 240), ('camp', 240), ('camp', 0)]]
    images += ['docs/contact-shade-depleted.jpg', 'docs/contact-shade-motion.jpg', 'docs/contact-shade-mobile.jpg']
    for name in images:
        assert (ROOT / name).read_bytes().startswith(b'\xff\xd8\xff')
    evidence = ['docs/contact-shade-before.json', 'docs/contact-shade-after.json', 'docs/contact-shade-gpu-desktop.json', 'docs/contact-shade-gpu-mobile.json', 'docs/contact-shade-focused.txt', 'docs/contact-shade-tests.txt', 'docs/contact-shade-red.txt'] + images
    result = {'passed': True, 'candidateOnly': True, 'fullTests': 237, 'focusedTests': 16, 'sourceSha256': SOURCE_SHA,
              'imagesReviewed': images, 'evidenceSha256': {n: sha(n) for n in evidence}, 'gpu': gpu,
              'boundedContactShadeAccepted': True, 'physicalContactAccepted': False, 'currentSourceLongRunAccepted': False,
              'ordinarySaveChanged': False, 'candidateDelivered': False, 'm5Complete': False, 'fullGoalComplete': False,
              'limits': 'Analytic radial darkening on production terrain triangles, not physical AO/IK or corrected feet. Declared fixture placements and overridden review camera, no ordinary campaign. GPU60 samples per phase, no strict simultaneous A/B, long-run, sound audition, VRAM or physical-phone proof. Baseline23156d79 package and ordinary7a61 save preserved; their600s evidence is historical for this candidate. Initial RED is missing feature module, not three reproduced behavior regressions.'}
    (ROOT / 'docs/contact-shade-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ['sourceSha256', 'evidenceSha256', 'imagesReviewed']}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
