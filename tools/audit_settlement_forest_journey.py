"""Audit the declared current-package native journey without upgrading it to whole-game quality proof."""
from pathlib import Path
import argparse,hashlib,json,math

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def stats(values):
    values=sorted(values)
    return None if not values else {'count':len(values),'median':values[len(values)//2],'p95':values[min(len(values)-1,math.ceil(len(values)*.95)-1)],'max':values[-1]}
def audit(folder):
    root=Path(folder);r=json.loads((root/'raw.json').read_text());assert r['complete'] and r['reloadExact'] and not r['logs'] and r['respawns']==0
    probe=r['probe'];assert probe.get('cameraCasesDropped',0)==0;assert probe['dropped']==probe['hiddenFrames']==probe['timeouts']==probe['disjointFrames']==0 and not probe['contextLost'] and not probe['errors'] and probe['issued']==probe['deleted']
    batches=[json.loads(line) for line in (root/'samples.jsonl').read_text().splitlines()];frames=[v for b in batches for v in b['frames']];gpu=[v for b in batches for v in b['gpu']];resources=[v for b in batches for v in b['resources']]
    assert len(frames)==probe['frames'] and probe['completed']==len(gpu)
    assert [v[0] for v in frames]==list(range(len(frames))) and all(len(v)==len(probe.get('columns',range(16))) for v in frames)
    assert all(v['frame']%8==0 and v['frame']<len(frames) for v in gpu)
    assert set(v[12] for v in frames)=={4},'Expected the actual complete four-pass HDR pipeline'
    assert (frames[-1][1]-frames[0][1])/1000>=600,'A short capture cannot pass as ten minutes'
    assert all(b[2]>=a[2] for a,b in zip(frames,frames[1:]))
    expected=[1920,1080] if r['width']==1920 else [585,1266]
    assert resources and all(v['buffer']==expected and v['glError']==0 for v in resources)
    assert sha(Path('docs/yard-delivery-2026-11-15/desktop-final-save.json'))==r['initialSaveSha256']
    assert sha(root/'probe-source.js')==r['probeSha256'] and sha(root/'timer-source.js')==r['timerSha256']
    manifest=json.loads(Path('dist/tidelands-m5-2026-11-15-yard.json').read_text());assert sha(Path('dist/tidelands-m5-2026-11-15-yard.zip'))==r['packageSha256']==manifest['archiveSha256']
    phases={v['name']:v for v in r['phases']}
    for p in phases.values():assert sha(root/p['save'])==p['saveSha256'] and sha(root/p['image'])==p['imageSha256']
    initial=json.loads(Path('docs/yard-delivery-2026-11-15/desktop-final-save.json').read_text());final=json.loads((root/'final-save.json').read_text())
    assert phases['02-forest-gather']['inventory']['wood']>phases['01-forest-arrival']['inventory']['wood']
    assert phases['03-forest-combat']['kills']>initial['kills'] and final['quest']==6 and final['player']['hp']==100 and final['buildings']==initial['buildings']
    assert math.hypot(phases['01-forest-arrival']['player']['x']-132,phases['01-forest-arrival']['player']['z']+26)<6
    assert sha(root/r['video'])==r['videoSha256']
    start=frames[0][1];steady=[v for v in frames if v[1]>=start+10000];steady_gpu=[v['ms'] for v in gpu if frames[v['frame']][1]>=start+10000]
    turns=[];turn_cases=[]
    for a,b in zip(steady,steady[1:]):
        aa=math.atan2(a[13]-a[3],a[15]-a[4]);bb=math.atan2(b[13]-b[3],b[15]-b[4]);angle=abs(math.atan2(math.sin(bb-aa),math.cos(bb-aa)))*180/math.pi;turns.append(angle)
        if angle>45:turn_cases.append({'degrees':angle,'before':a,'after':b})
    gpu_stats=stats(steady_gpu)
    return {'width':r['width'],'dpr':r['dpr'],'buffer':expected,'completeJourney':True,'fullGameOr3AAccepted':False,'frames':len(frames),'wallSeconds':(frames[-1][1]-frames[0][1])/1000,'gameSeconds':frames[-1][2]-frames[0][2],'pathMetres':sum(math.hypot(b[3]-a[3],b[4]-a[4]) for a,b in zip(frames,frames[1:])),'actualMovingFrames':sum(math.hypot(b[3]-a[3],b[4]-a[4])>1e-5 for a,b in zip(frames,frames[1:])),'completeHdrPasses':4,'gpuMs':gpu_stats,'gpuP95Under25ms':bool(gpu_stats and gpu_stats['p95']<25),'drawCpuMs':stats([v[8] for v in steady]),'renderSubmitCpuMs':stats([v[9] for v in steady]),'rafMs':stats([v[7] for v in steady if v[7] is not None]),'rafOver50ms':sum(v[7]>50 for v in steady if v[7] is not None),'horizontalCameraOrbitDegrees':stats(turns),'horizontalCameraTurnsOver45Degrees':sum(v>45 for v in turns),'horizontalCameraCases':turn_cases,'auditToolSha256':sha(Path(__file__)),'drawCalls':stats([v[10] for v in steady]),'triangles':stats([v[11] for v in steady]),'capturedCameraCaseCount':sum(len(b.get('cameraCases',[])) for b in batches),'queryLifecycle':probe,'heapSamples':r['heap'],'resourceRanges':{k:[min(v[k] for v in resources),max(v[k] for v in resources)] for k in ['geometries','textures','programs']},'finalQuest':final['quest'],'finalKills':final['kills'],'finalInventory':final['inventory'],'finalSaveSha256':sha(root/'final-save.json'),'archiveSha256':r['packageSha256'],'filesSha256':{p.name:sha(p) for p in [root/'raw.json',root/'samples.jsonl',root/'inputs.jsonl',root/r['video'],root/'final-save.json']},'scope':r['scope']}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('folder');parser.add_argument('--output',default='audit.json');args=parser.parse_args();assert Path(args.output).name==args.output;target=Path(args.folder)/args.output;assert not target.exists();result=audit(args.folder);target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['frames','wallSeconds','pathMetres','gpuMs','gpuP95Under25ms','rafMs','horizontalCameraTurnsOver45Degrees','finalKills']}))
