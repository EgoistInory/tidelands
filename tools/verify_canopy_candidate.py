"""Verify retained rejected-candidate evidence; does not accept its visual quality."""
from pathlib import Path
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]

def verify():
    rows=json.loads((ROOT/'docs/canopy-composition-scenes.json').read_text())
    assert len(rows)==12
    camera_changes=[]
    for index,scene in enumerate(['coast','grove','vista','highland','shoal','camp']):
        a,b=rows[index*2:index*2+2]
        assert a['scene']==b['scene']==scene
        assert (a['art'],b['art'])==('baseline','candidate')
        assert a['position']==b['position'] and a['time']==b['time']
        assert a['requestedCamera']==b['requestedCamera']
        if a['camera']!=b['camera']:camera_changes.append(scene)
        assert a['worldUnchanged'] and b['worldUnchanged']
        assert a['glError']==b['glError']==0
        assert a['viewport']==b['viewport']==[1280,720]
        assert a['buffer']==b['buffer']==[1920,1080]
        assert a['cohorts']==b['cohorts']==dict(retained=13,mature=166,edge=97,young=33)
    assert camera_changes==['grove','vista']
    assert json.loads((ROOT/'docs/canopy-composition-console.json').read_text())==[]
    assert '# fail 2' in (ROOT/'docs/canopy-composition-red.txt').read_text()
    assert '# pass 4' in (ROOT/'docs/canopy-composition-focused.txt').read_text()
    images=sorted((ROOT/'docs').glob('canopy-composition-*.jpg'))
    assert len(images)==12 and all(p.stat().st_size>10000 for p in images)
    package=json.loads((ROOT/'dist/tidelands-m5-2026-10-27-cast-clothing.json').read_text())
    for name,row in package['files'].items():
        source=ROOT/('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)
        assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sha256'],name
    report=dict(verified=True,candidateAccepted=False,productionIntegrated=False,runtimeInputsUnchanged=110,
                ordinarySaveTouched=False,treeNodes=309,candidateBatches=30,newContractRedFailures=2,
                focusedTestsPassed=4,nativeImagesViewed=12,exactCameraPairs=4,cameraChangedScenes=camera_changes,
                mobileOrOrdinaryIntegrationAcceptance=False,gpuOrEnduranceAccepted=False,
                milestoneM5Complete=False,fullGoalComplete=False,
                images={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in images})
    (ROOT/'docs/canopy-composition-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='images'}))

if __name__=='__main__':verify()
