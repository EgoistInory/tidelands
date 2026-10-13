"""Audit bounded camera progress without claiming M5 completion."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT/name).read_text())
def sha(name):
    return hashlib.sha256((ROOT/name).read_bytes()).hexdigest()

def verify():
    initial = read('docs/camera-intent-ui.json')
    final = read('docs/camera-intent-final-ui.json')
    before = read('docs/camera-intent-before-routes.json')
    boundary = read('docs/camera-intent-boundary.json')
    assert initial['baseline']['row']['maxIntentOverwriteDegrees'] > 89
    assert not initial['console']['baseline'] and not initial['console']['fixed'] and not final['console']
    assert len(final['day']) == 6
    for row in final['day']:
        assert row['ready'] and row['glError'] == 0 and row['row']['frames'] == 180
        assert row['row']['maxIntentOverwriteDegrees'] == 0
    assert len(initial['night']) == 6 and len(initial['mobile']) == 2 and len(before) == 5
    assert all(r['viewport'] == [390,844] and r['glError'] == 0 for r in initial['mobile'])
    assert boundary['previousFocusInside'] and not boundary['currentFocusInside']
    assert boundary['jump']['stepDegrees'] > 100
    assert not final['physicalMotionQualityPassed'] and not final['fullGoalComplete']
    tests = (ROOT/'docs/camera-intent-tests-final.txt').read_text()
    focused = (ROOT/'docs/camera-intent-tests-focused.txt').read_text()
    baseline = (ROOT/'docs/camera-intent-tests-baseline.txt').read_text()
    assert '# tests 190\n' in tests and '# pass 190\n' in tests and '# fail 0\n' in tests
    assert '# tests 13\n' in focused and '# pass 13\n' in focused
    assert '# tests 3\n' in baseline and '# fail 3\n' in baseline
    package = read('dist/tidelands-m5-2026-10-12-movement-heading.json')
    assert sha('dist/' + package['archive']) == package['archiveSha256']
    changed=[]
    for name, record in package['files'].items():
        path='docs/LOCAL-DELIVERY.md' if name=='README.md' else name
        if sha(path) != record['sha256']: changed.append(name)
    assert sorted(changed) == ['src/camera.js','src/scene.js']
    assert sha('docs/current-journey-final-camp-save.json') == '0dc650a3ac8a83b62ea3e33c8797607f50d7f60b49b9a07e941e9040a196655e'
    inputs=['src/camera.js','src/scene.js','tests/camera-intent.test.js','tests/camera-intent.html','tools/diagnose_camera_intent.mjs','tools/diagnose_camera_intent_boundary.mjs','docs/camera-intent-ui.json','docs/camera-intent-final-ui.json','docs/camera-intent-before-routes.json','docs/camera-intent-boundary.json','docs/M5-WHOLE-REVIEW.md','docs/camera-intent-tests-final.txt','docs/camera-intent-tests-focused.txt','docs/camera-intent-tests-baseline.txt']
    images=sorted((ROOT/'docs').glob('camera-intent-*.jpg'))
    assert len(images)==15
    report={'passed':True,'kind':'candidate-camera-intent-progress-audit','intentRegressionPassed':True,'physicalMotionQualityPassed':False,'fullGoalComplete':False,'milestoneM5Complete':False,'newDeliveryPackageProduced':False,'priorOrdinarySaveAndPackagePreserved':True,'changedRuntimeFiles':changed,'unitTests':{'focused':13,'full':190,'baselineExpectedFailures':3},'sourceAndEvidenceSha256':{p:sha(p) for p in inputs},'imagesViewedSha256':{str(p.relative_to(ROOT)):sha(p.relative_to(ROOT)) for p in images},'finalRenderedForestJumpDegrees':boundary['jump']['stepDegrees'],'nextAction':'Reproduce frame50 origin leaving crystal944 box before collision repair; keep requested yaw and safety-side progress, then complete the whole motion/contact group before new package or M5 acceptance.','limits':['Initial14 rendered pictures and UI data predate preferred-side addition; final forest image/data use candidate camera and scene.','Old-version movement paths differ because old yaw steered input; no all-route physical comparison or performance inference.','Fixed-dt no-enemies/quest6/camp fixtures; no browser save access, native input, listening, GPU, real device or new long-time result.']}
    (ROOT/'docs/camera-intent-progress-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':True,'intentRegressionPassed':True,'physicalMotionQualityPassed':False,'fullGoalComplete':False},ensure_ascii=False))

if __name__ == '__main__':
    verify()
