"""Validate current-source GPU samples; image quality remains explicitly unaccepted."""
from pathlib import Path
import hashlib,json,math
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def load(name):return json.loads((ROOT/'docs'/name).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    package=json.loads((ROOT/'dist/tidelands-m5-2026-10-27-coastal-contact-budget.json').read_text())
    assert len(package['files'])==181
    for name,row in package['files'].items():assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name))==row['sha256']
    runs=[]
    for name,viewport,buffer in [('desktop',[1280,720],[1920,1080]),('second',[390,844],[390,844])]:
        d=load(f'coastal-current-gpu-{name}.json');assert d['complete'] and d['supported'] and not d['hidden'] and d['disjointCount']==0
        assert d['runtimeInputs']==181 and d['coastalResourceIds']==133 and d['authoredCastInstalled'] and d['woodlandInstalled'] and d['timerBits']>0
        assert d['viewport']==d['canvasCssSize']==viewport and d['canvasBuffer']==buffer
        assert [r['phase'] for r in d['rows']]==['shore','forest-combat','highland','amber-swim','night-camp']
        for row in d['rows']:
            values=row['gpuRawMs'];assert len(values)==60 and all(math.isfinite(n) and n>0 for n in values) and row['glError']==0
            ordered=sorted(values);assert abs(ordered[57]-row['gpuMs']['p95'])<.00011 and abs(ordered[-1]-row['gpuMs']['max'])<.00011
        assert d['rows'][1]['hits']>0
        runs.append({'viewport':viewport,'buffer':buffer,'samples':sum(len(r['gpuRawMs']) for r in d['rows']),'gpuP95Ms':{r['phase']:r['gpuMs']['p95'] for r in d['rows']},'gpuMaxMs':max(r['gpuMs']['max'] for r in d['rows']),'scriptedCombatHits':d['rows'][1]['hits']})
    scenes=load('coastal-overall-scenes.json');assert len(scenes)==5 and {s['scene'] for s in scenes}=={'coast','forest','highland','shoal','camp'}
    for row in scenes:assert row['runtimeInputs']==181 and row['coastalResourceIds']==133 and row['authoredCast'] and row['woodlandInstalled'] and row['glError']==0
    motion=load('coastal-overall-forest-motion.json');assert motion['frames']==180 and 20.99<motion['distance']<21.01 and not motion['hidden'] and motion['hp']==100 and motion['glError']==0
    attempted=load('coastal-overall-narrow.json');assert attempted['viewport']==[1280,720] # preserved failed viewport attempt, not mobile art proof
    support=load('coastal-current-creature-support.json');assert support['enemies']==79 and support['samples']==158 and len(support['allRows'])==158
    assert load('coastal-current-gpu-console.json')==load('coastal-overall-console.json')==[]
    images=[f'coastal-overall-{place}.png' for place in ['coast','forest','highland','shoal','camp','forest-motion']]+['coastal-current-gpu-desktop.png','coastal-current-gpu-second.png']
    for name in images:
        with Image.open(ROOT/'docs'/name) as im:assert im.size==((390,844) if name.endswith('second.png') else (1280,720))
    report=dict(verified=True,runtimeFiles=181,packageSha256=package['archiveSha256'],currentSourceShortGpuEvidenceVerified=True,gpuQueries=600,runs=runs,staticSceneImagesViewed=5,motionFrames=180,motionDistance=motion['distance'],acceptedImagesViewed=8,failedNarrowArtAttemptRetained=True,actualNarrowGpuVerified=True,creatureSupportRows=158,creatureContactMinimumOver15cm=len(support['over15cm']),visibleFarProxyMinimumOver15cm=len(support['proxyOver15cm']),maxIndividualContactGap=max(r['maxFootGap'] for r in support['allRows']),completeFootContactOrNaturalnessAccepted=False,fullVisualQualityAccepted=False,currentEnduranceAccepted=False,physicalDeviceVerified=False,audioListeningVerified=False,milestoneM5Complete=False,fullGoalComplete=False,images={name:sha(ROOT/'docs'/name) for name in images},sources={name:sha(ROOT/name) for name in ['tests/current-coastal-gpu.html','tests/current-coastal-overall.html','tools/audit_current_creature_support.mjs']})
    (ROOT/'docs/current-coastal-quality-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['images','sources']},ensure_ascii=False))
if __name__=='__main__':verify()
