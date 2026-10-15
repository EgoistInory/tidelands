"""Verify the bounded camera candidate against the immutable island-spaces delivery."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    old=json.loads((ROOT/'dist/tidelands-m5-2026-10-16-island-spaces.json').read_text())
    changed=[p for p,v in old['files'].items() if sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)!=v['sha256']]
    assert changed==['src/camera.js'],changed
    assert sha('dist/'+old['archive'])==old['archiveSha256']
    for label,count in [('tests',222),('focused',23)]:
        s=(ROOT/f'docs/camera-continuity-{label}.txt').read_text()
        assert f'# tests {count}\n' in s and f'# pass {count}\n' in s and '# fail 0\n' in s
    red=(ROOT/'docs/camera-continuity-red.txt').read_text();assert '# fail 1\n' in red and 'got32.0934648608596' in red
    ui=json.loads((ROOT/'docs/camera-continuity-render.json').read_text())
    assert len(ui['candidate'])==10 and len(ui['baseline'])==6 and not ui['console'] and not ui['baselineConsole']
    for r in ui['candidate']+ui['baseline']:
        assert r['glError']==0 and r['row']['frames']==180 and r['row']['maxIntentOverwriteDegrees']==0 and r['row']['minFocusDistance']>6
    assert all(r['viewport']==[390,844] for r in ui['candidate'][-3:])
    comparison=[]
    for before,after in zip(ui['baseline'],ui['candidate'][:6]):
        assert before['route']==after['route'] and before['player']==after['player']
        b,a=before['row']['maxRenderedBearingStepDegrees'],after['row']['maxRenderedBearingStepDegrees']
        assert a<=b+1e-8
        comparison.append({'route':after['route'],'oldMaxDegrees':b,'candidateMaxDegrees':a,'candidateMaxRadialStep':after['row']['maxRadialStep']})
    assert comparison[0]['oldMaxDegrees']>32 and comparison[0]['candidateMaxDegrees']<12
    assert sha('docs/island-spaces-normal-save.json')=='e750698e0f888933e089bf8b0e76ebd9890c36d9bd8fcc1b3f5188f80709439c'
    images={f'docs/camera-continuity-{name}.png':sha(f'docs/camera-continuity-{name}.png') for name in ['forest','lamp','night-camp','mobile']}
    evidence={f'docs/camera-continuity-{name}':sha(f'docs/camera-continuity-{name}') for name in ['tests.txt','focused.txt','red.txt','probes.json','render.json']}
    report={'candidateVerified':True,'delivered':False,'fullGoalComplete':False,'milestoneM5Complete':False,'physicalMotionQualityPassed':False,'changedRuntime':{p:sha(p) for p in changed},'unchangedRuntimeFiles':50,'fullTests':222,'focusedTests':23,'comparison':comparison,'renderedRows':10,'baselineRows':6,'imagesReviewedSha256':images,'evidenceSha256':evidence,'scope':'Fixed-dt production WorldView fixtures, six old/new desktop routes plus night camp and three390 routes; no ordinary save/input, listening, GPU, real-device or continuous endurance acceptance. Only camera fallback angle changed. Existing7dd delivery remains authoritative.','remaining':'Residual lamp12.4677degree turn and camp9.3731m radial correction remain; do not claim smooth physical framing or3A acceptance. Continue whole-body/ground/sound review as a group before packaging and final unified main path.'}
    (ROOT/'docs/camera-continuity-candidate.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['imagesReviewedSha256','evidenceSha256']},ensure_ascii=False))
if __name__=='__main__': verify()
