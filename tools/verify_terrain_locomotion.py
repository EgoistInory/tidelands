"""Verify bounded irregular-terrain motion evidence, without claiming complete motion quality."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    old=json.loads((ROOT/'dist/tidelands-m5-2026-10-16-island-spaces.json').read_text())
    changed=[p for p,v in old['files'].items() if sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)!=v['sha256']]
    assert set(changed)=={'src/camera.js','src/character.js'},changed
    assert sha('dist/'+old['archive'])==old['archiveSha256']
    for label,count in [('tests',223),('focused',55)]:
        s=(ROOT/f'docs/terrain-locomotion-{label}.txt').read_text()
        assert f'# tests {count}\n' in s and f'# pass {count}\n' in s and '# fail 0\n' in s
    red=(ROOT/'docs/terrain-locomotion-red.txt').read_text();assert '# fail 1\n' in red and 'pelvis=-0.8702284805780769' in red
    baseline=json.loads((ROOT/'docs/world-motion-baseline.json').read_text());ui=json.loads((ROOT/'docs/world-motion-candidate.json').read_text())
    assert len(baseline['rows'])==6 and len(ui['rows'])==6 and not baseline['console'] and not ui['console']
    comparison=[]
    for before in baseline['rows']:
        after=next(r for r in ui['rows'] if r['route']==before['route'])
        assert before['player']==after['player'] and before['row']['distance']==after['row']['distance']
        for r in [before,after]:
            assert r['row']['frames']==360 and r['glError']==0 and r['row']['maxPlantedDrift']<1e-6
        comparison.append({'route':after['route'],'distance':after['row']['distance'],'oldPelvisMinimum':before['row']['minPelvisOffset'],'candidatePelvisMinimum':after['row']['minPelvisOffset'],'candidateMinPlantedSoleGap':after['row']['minPlantedSoleGap'],'candidateMaxPlantedDrift':after['row']['maxPlantedDrift'],'swimmingFrames':after['row']['swimmingFrames'],'landFrames':after['row']['landFrames']})
    h=next(r for r in comparison if r['route']=='highland');assert h['oldPelvisMinimum']<-.8 and h['candidatePelvisMinimum']>-.6
    for name in ['water','shore']:
        r=next(r for r in comparison if r['route']==name);assert r['swimmingFrames']>60 and r['landFrames']>60
    before=json.loads((ROOT/'docs/world-motion-highland-probes.json').read_text());after=json.loads((ROOT/'docs/world-motion-highland-candidate-probes.json').read_text())
    assert abs(before['worst']['pelvisOffset']-h['oldPelvisMinimum'])<1e-8 and abs(after['worst']['pelvisOffset']-h['candidatePelvisMinimum'])<1e-8
    assert ui['peak']['row']['frames']==31 and ui['peak']['glError']==0
    assert ui['mobile']['viewport']==[390,844] and ui['mobile']['row']['frames']==360 and ui['mobile']['glError']==0
    assert sha('docs/island-spaces-normal-save.json')=='e750698e0f888933e089bf8b0e76ebd9890c36d9bd8fcc1b3f5188f80709439c'
    images={f'docs/world-motion-{name}.png':sha(f'docs/world-motion-{name}.png') for name in ['highland','mineral','water','shore','candidate-peak','candidate-shore','candidate-mobile']}
    evidence={f'docs/{name}':sha(f'docs/{name}') for name in ['world-motion-baseline.json','world-motion-candidate.json','world-motion-highland-probes.json','world-motion-highland-candidate-probes.json','terrain-locomotion-tests.txt','terrain-locomotion-focused.txt','terrain-locomotion-red.txt']}
    report={'candidateVerified':True,'delivered':False,'fullGoalComplete':False,'milestoneM5Complete':False,'physicalMotionQualityPassed':False,'changedRuntime':{p:sha(p) for p in changed},'unchangedRuntimeFiles':49,'fullTests':223,'focusedTests':55,'baselineCharacterSha256':'135d0e8ed644a55a4581e06510688e129380f492cb9747f31eaf4780f12d966f','comparison':comparison,'imagesReviewedSha256':images,'evidenceSha256':evidence,'scope':'Production movePlayer, terrain and WorldView; explicit no-enemies/axe fixtures,60stationary warmup plus360fixed-dt frames per case. Endpoint/body/contact comparison and390 sample; no native-save, GPU/rAF performance, listening or full-quality acceptance. Camera six-route audit belongs to prior dabe3d1 source; same camera module retained. Existing7dd/e750 delivery unchanged.','remaining':'Planted downhill reach, residual pelvis lowering, sub-millimetre curved-terrain sole gaps, abrupt camera radial corrections, natural animation/visual style and listening remain whole-quality tasks. This group corrects a specific downhill airborne reach failure only; no isolated-model perfection loop.'}
    (ROOT/'docs/terrain-locomotion-candidate.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['imagesReviewedSha256','evidenceSha256']},ensure_ascii=False))
if __name__=='__main__': verify()
