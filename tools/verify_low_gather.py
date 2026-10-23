"""Verify the bounded whole-body low pickup evidence without claiming full motion quality."""
import hashlib
import json
import math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
load=lambda p:json.loads((ROOT/p).read_text())

def verify():
    rows=load('docs/low-gather-browser.json');by_name={r['name']:r['data'] for r in rows}
    for row in by_name.values():
        assert not row['running'] and row['glError']==0 and row['soleError']<.003
        for path,digest in row['sources'].items():assert sha(path)==digest,path
    for kind in ['fiber','berry','shell']:
        row=by_name[kind+'-impact'];assert row['frames']==21 and row['action']['name']=='Fixing_Kneeling'
        assert row['wristTargetError']<.04 and len(row['events'])==1 and '+2' in row['events'][0]['message'].replace(' ','')
        assert row['inventory'][kind]==(5 if kind=='berry' else 2)
    assert by_name['shell-mobile-impact']['viewport']==[390,844]
    assert by_name['shell-mobile-impact']['buffer'][0]==390
    assert by_name['fiber-far-impact']['wristTargetError']>.5
    assert by_name['fiber-recovered']['action'] is None and by_name['fiber-recovered']['inventory']['fiber']==2
    main=load('docs/low-gather-main-browser.json');assert {r['name'] for r in main}=={'fiber-main-success','fiber-main-cancel'}
    for r in main:
        row=r['data'];assert not r['console'] and row['glError']==0 and row['paused'] and row['authored'] and row['hp']==100
        for path,digest in row['sources'].items():assert sha(path)==digest,path
        if row['scenario']=='cancel':
            assert row['inventory']['fiber']==0 and not row['events'] and not row['sounds'] and row['reachTarget'] is None and row['plan']['action'] is None
        else:
            assert row['inventory']['fiber']==2 and len(row['events'])==len(row['sounds'])==1
            assert row['sounds'][0]['kind']=='gather' and row['sounds'][0]['context']=='running' and row['sounds'][0]['time']==row['events'][0]['time']
            assert row['plan']['action']=='gather' and .5<=row['plan']['actionProgress']<.6
            pose=row['poses'][-1];assert pose['source']['name']=='Fixing_Kneeling'
            assert math.dist(pose['wrist'],[pose['target'][k] for k in ['x','y','z']])<.04
    for filename,count in [('low-gather-focused',33),('low-gather-full-tests',291)]:
        log=(ROOT/('docs/'+filename+'.txt')).read_text();assert f'# pass {count}\n' in log and '# fail 0\n' in log
    assert 'whole-body pelvis never lowered' in (ROOT/'docs/low-gather-red.txt').read_text()
    cpu=load('docs/low-gather-world-cpu.json');assert len(cpu['rows'])==36 and sum(r['frames'] for r in cpu['rows'])==8424
    assert max(r['maxError'] for r in cpu['rows'])<.003 and sum(r['respawns'] for r in cpu['rows'])==0
    for p,d in cpu['files'].items():assert sha(p)==d,p
    calibration=load('assets/characters/action-landmarks.json');assert calibration['toolCalibration']['sourceSha256']==sha('src/authored-character.js')
    old=load('docs/authored-motion-audit.json');assert not old['fullGoalComplete']
    assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    assert sha('dist/tidelands-m5-2026-10-23-motion-impact-r2.zip')=='5efddbb97fb0986f2d30e922108edce5f7384c82d9def94a9385e7ad69feaa7e'
    images=['fiber-before','fiber-impact','fiber-recovered','berry-impact','shell-impact','fiber-far','shell-mobile','main-fiber','main-cancel']
    files=['docs/low-gather-'+n+'.jpg' for n in images]
    for p in files:assert (ROOT/p).read_bytes()[:2]==b'\xff\xd8',p
    files+=['docs/low-gather-browser.json','docs/low-gather-main-browser.json','docs/low-gather-world-cpu.json','docs/low-gather-source-poses.json','docs/low-gather-focused.txt','docs/low-gather-full-tests.txt','docs/low-gather-red.txt','tests/authored-low-gather.test.js','tests/low-gather-review.html','tests/low-gather-main-review.html','tools/probe_low_gather_source.mjs','assets/characters/action-landmarks.json','src/authored-character.js','src/main.js','src/scene.js']
    result={'verified':True,'boundedLowGatherAccepted':True,'fullMotionQualityAccepted':False,'milestoneM5Complete':False,'fullGoalComplete':False,'scope':'Near real low-resource proxy and full-body kneel/recovery. Native E/main/resolve/audio success and actual pause cancellation in declared isolated fixtures. Far node remains unreachable by hand without bone stretching; target is terrain+.35 proxy, not actual mesh. Frozen-pose QA .01 game seconds per rAF is not real-time playback/performance. Repeated paused poses in first main row are retained, not distinct simulation frames. Not ordinary campaign, new exact-source600s/GPU, device, audition or complete naturalness.','focusedTests':33,'fullTests':291,'nearWristErrors':{k:by_name[k+'-impact']['wristTargetError'] for k in ['fiber','berry','shell']},'farWristError':by_name['fiber-far-impact']['wristTargetError'],'worldBoneSupportMaxError':max(r['maxError'] for r in cpu['rows']),'files':{p:sha(p) for p in files}}
    (ROOT/'docs/low-gather-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result
if __name__=='__main__':
    r=verify();print(json.dumps({k:v for k,v in r.items() if k!='files'},ensure_ascii=False,indent=2))
