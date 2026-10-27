"""Verify bounded representation evidence without claiming GPU or full-game quality."""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageChops,ImageStat
ROOT=Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/'docs'/name).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    package=json.loads((ROOT/'dist/tidelands-m5-2026-10-27-cast-clothing.json').read_text())
    for name,row in package['files'].items():assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name))==row['sha256']
    for name,count in [('coastal-budget-full-tests.txt',350),('coastal-level-budget-focused.txt',2)]:
        log=(ROOT/'docs'/name).read_text();assert f'# pass {count}\n' in log and '# fail 0\n' in log
    red=(ROOT/'docs/coastal-level-budget-red.txt').read_text();assert '# pass 0\n' in red and '# fail 2\n' in red
    comparisons=[];rows=read('coastal-batch-pairs.json')
    for place in ['coast','shoal','dense','camp']:
        a,b=[next(r for r in rows if r['place']==place and r['mode']==mode) for mode in ['cards','batch']]
        for key in ['camera','quaternion','player','time','levels','buffer']:assert a[key]==b[key]
        assert b['render']['calls']<a['render']['calls'] and 0<=b['render']['triangles']-a['render']['triangles']<=200
        with Image.open(ROOT/f'docs/coastal-batch-pair-{place}-cards.png') as ia,Image.open(ROOT/f'docs/coastal-batch-pair-{place}-batch.png') as ib:
            diff=ImageChops.difference(ia.convert('RGB').crop((0,55,1280,720)),ib.convert('RGB').crop((0,55,1280,720)))
            mean=ImageStat.Stat(diff).mean;assert max(mean)<.003
        comparisons.append(dict(place=place,callsBefore=a['render']['calls'],callsAfter=b['render']['calls'],extraTriangles=b['render']['triangles']-a['render']['triangles'],meanAbsRgb=mean,compositionAccepted=place!='dense'))
    profiles=[];budget=read('coastal-budget-pairs.json')
    for place in ['coast','shoal','camp']:
        a,b=[next(r for r in budget if r['place']==place and r['mode']==mode) for mode in ['batch','budget']]
        for key in ['camera','quaternion','player','time','buffer']:assert a[key]==b[key]
        assert b['render']['triangles']<a['render']['triangles'] and b['levels']['near']<=1 and b['levels']['mid']<=3
        profiles.append(dict(place=place,trianglesBefore=a['render']['triangles'],trianglesAfter=b['render']['triangles']))
    motion=[]
    for size in ['desktop','narrow']:
        row=read(f'coastal-budget-motion-{size}.json');m=row['motion'];assert m['frames']==m['positionSamples']==240 and m['maxDisplacement']>7 and m['distinctNodeLevels']>133 and row['glError']==0
        motion.append(dict(size=size,**m))
    main=read('coastal-budget-main-rows.json');start,blocked,cut,passed=main
    assert start['player']['x']==blocked['player']['x'] and start['player']['z']==blocked['player']['z']
    assert cut['inventory']['wood']==start['inventory']['wood']+3 and cut['targetDepleted'] and not cut['targetVisible']
    assert passed['player']['z']-cut['player']['z']>5
    narrow=read('coastal-budget-main-narrow.json');assert narrow['viewport']==narrow['buffer']==[390,844] and narrow['player']['x']==passed['player']['x'] and narrow['player']['z']==passed['player']['z']
    allrows=rows+budget+main+[narrow,read('coastal-budget-narrow-start.json')]
    for row in allrows:assert row['worldUnchanged'] and row['glError']==0
    assert read('coastal-budget-main-console.json')==read('coastal-budget-review-console.json')==[]
    images=list((ROOT/'docs').glob('coastal-batch-pair-*.png'))+list((ROOT/'docs').glob('coastal-budget-*.png'))
    assert len(images)==19
    for path in images:
        with Image.open(path) as im:assert im.size in [(1280,720),(390,844)]
    report=dict(verified=True,productionIntegrated=False,productionRuntimeInputsUnchanged=len(package['files']),rootTestsPassed=350,newBudgetContractsPassed=2,nativeImagesViewed=19,farInstanceSameCameraComparisons=comparisons,boundedProfileComparisons=profiles,motion=motion,nativeMainBlockedGatheredAndPassed=True,narrowMainViewport=[390,844],mainPassageDelta=passed['player']['z']-cut['player']['z'],ordinarySaveTouched=False,farInstancingFiniteIncrementAccepted=True,budgetProfileFiniteReviewPassed=True,seamlessLodQualityAccepted=False,currentGpuOrEnduranceAccepted=False,physicalDeviceVerified=False,milestoneM5Complete=False,fullGoalComplete=False,
                remaining=['Near/mid rendering still uses per-tree meshes with bounded count','Dense-node fixture starts inside geometry and is stress workload only','Four-view impostor brightness and discrete LOD changes remain quality backlog','240 rAF/physics frames are not native input, GPU time or endurance','Native main fixture uses declared position/materials/q6/79 zero-HP creatures; no ordinary campaign replay','Desktop motion predates resize-listener-only addition; narrow/main use current sources'],images={p.name:sha(p) for p in images},sources={name:sha(ROOT/name) for name in ['tests/coastal-far-batches.js','tests/coastal-level-budget.js','tests/coastal-budget-visual.js','tests/coastal-budget-main.html','tests/coastal-batch-review.js','tests/coastal-batch-review.html']})
    (ROOT/'docs/coastal-budget-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['images','sources','remaining']},ensure_ascii=False))
if __name__=='__main__':verify()
