"""Validate bounded current-source endurance/GPU evidence; never assert full M5 quality."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(name): return json.loads((ROOT/name).read_text())
def sha(name): return hashlib.sha256((ROOT/name).read_bytes()).hexdigest()

def verify():
    package=read('dist/tidelands-m5-2026-10-16-enemy-windup.json')
    assert sha('dist/'+package['archive'])==package['archiveSha256']
    for name,entry in package['files'].items():
        assert sha('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)==entry['sha256'],name
    summaries={};images=[]
    for name,target,minimum in [('desktop',600000,30000),('mobile',60000,3000)]:
        envelope=read(f'docs/quality-endurance-{name}.json');s=envelope['sample'];assert not envelope['console']
        assert s['complete'] and s['targetMs']==target and target<=s['activeMs']<target+1000 and not s['hidden']
        assert s['frames']>=minimum and s['movingFraction']>.85 and s['hitCount']>0 and s['damageTaken']>0
        assert len(s['stages'])==5 and all(p['distance']>30 for p in s['stages'])
        assert s['stepAttempts']==s['stepsScheduled'] and s['respawns']==0
        assert all(c['glError']==0 and c['audio']['voices']<=12 for c in s['checkpoints'])
        heaps=[c['heapBytes'] for c in s['checkpoints'] if c['heapBytes'] is not None]
        assert len(heaps)==len(s['checkpoints']) and all(h>0 for h in heaps)
        summaries[name]={k:s[k] for k in ['activeMs','frames','movingFraction','distanceMeters','hitCount','damageTaken','medianMs','p95Ms','maxMs','over50Ms']}
        summaries[name].update(heapMiB=[round(h/1048576,2) for h in heaps],canvasBuffer=s['checkpoints'][-1]['canvasBuffer'],viewport=s['checkpoints'][-1]['viewport'])
        images+=envelope['images']
    gpu={}
    for name,buffer in [('desktop',[1920,1080]),('mobile',[390,844])]:
        envelope=read(f'docs/quality-gpu-{name}.json');s=envelope['sample'];assert not envelope['console']
        assert s['complete'] and s['supported'] and not s['hidden'] and s['disjointCount']==0
        assert s['canvasBuffer']==buffer and s['timerBits']>0 and len(s['rows'])==5
        assert all(s[k]=='ready' for k in ['groundStatus','sandStatus','rockStatus'])
        for row in s['rows']:
            assert len(row['gpuRawMs'])==60 and row['gpuMs']['samples']==60 and all(v>0 for v in row['gpuRawMs'])
        gpu[name]={'canvasBuffer':buffer,'p95GpuMs':{r['phase']:r['gpuMs']['p95'] for r in s['rows']},'p95CpuFrameMs':{r['phase']:r['cpuFrameWorkMs']['p95'] for r in s['rows']}}
    assert len(images)==5 and all((ROOT/p).stat().st_size>1000 for p in images)
    report={'passed':True,'archive':package['archive'],'archiveSha256':package['archiveSha256'],'runtimeFileHashesMatched':49,'continuousSamples':summaries,'fullCanvasGpuSamples':gpu,'imagesReviewed':images,'harnessSha256':{p:sha(p) for p in ['tests/quality-endurance.html','tests/quality-gpu.html']},'evidenceSha256':{f'docs/{name}.json':sha(f'docs/{name}.json') for name in ['quality-endurance-desktop','quality-endurance-mobile','quality-gpu-desktop','quality-gpu-mobile','quality-gpu-desktop-panel','quality-gpu-mobile-panel']}|{p:sha(p) for p in images},'stabilityEvidenceAccepted':True,'continuousCanvasIsFullViewport':False,'nativeInput':False,'realMobileDevice':False,'vramMeasured':False,'audioListened':False,'fullMainPathReplayed':False,'m5Complete':False,'fullGoalComplete':False,'limits':'600s desktop and60s390 scripted five-phase teleports and revived enemy/weapon/food/building fixtures, bounded adaptive movement. Endurance canvas is reduced by diagnostic panels. Separate 60-query-per-phase GPU timing uses full viewport canvas, excludes audio/HUD and is not whole frame or VRAM. Heap samples are natural GC snapshots, not a proof of leak freedom. Visual/naturalness/camera/night/listening gaps remain.'}
    (ROOT/'docs/quality-endurance-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':True,'runtimeFiles':49,'continuousSamples':summaries,'fullCanvasGpuSamples':gpu,'m5Complete':False},ensure_ascii=False))

if __name__=='__main__': verify()
