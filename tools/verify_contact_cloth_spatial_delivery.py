"""Audit the bounded local contact/clothing/stereo delivery, not complete M5 quality."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-18-contact-cloth-spatial'
def read(n):return json.loads((ROOT/n).read_text())
def sha(n):return hashlib.sha256((ROOT/n).read_bytes()).hexdigest()

def verify():
    p=read('dist/'+NAME+'.json');v=read('docs/'+NAME+'-verification.json')
    assert v['passed'] and v['checkedFiles']==52 and v['archiveEntries']==53
    assert sha('dist/'+p['archive'])==p['archiveSha256']=='e14e48651558f35395b1d2d8d2be7aa065d56ef339b4641f4edd26359d0da87a'
    with zipfile.ZipFile(ROOT/'dist'/p['archive']) as z:
        assert z.testzip() is None
        for n,e in p['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if n=='README.md' else n)==e['sha256'], n
            assert hashlib.sha256(z.read('tidelands-local/'+n)).hexdigest()==e['sha256']
            assert hashlib.sha256((Path(v['extractedPath'])/n).read_bytes()).hexdigest()==e['sha256']
    text=(ROOT/'docs/contact-cloth-spatial-tests.txt').read_text()
    assert '# tests 241\n' in text and '# pass 241\n' in text and '# fail 0\n' in text
    assert 'Ran 4 tests' in (ROOT/'docs/contact-cloth-spatial-package-tests.txt').read_text()
    audio=read('docs/spatial-audio-audit.json');assert audio['passed'] and audio['nativeStereoVerified'] and audio['mainLoopSpatialCueVerified']
    assert all(sha(n)==h for n,h in audio['sourceSha256'].items())
    backup=read('docs/contact-cloth-spatial-backup-audit.json');assert backup['passed'] and backup['allFieldsPreserved'] and backup['quest']==6 and backup['kills']==3 and backup['player']['hp']==79
    assert sha('docs/contact-cloth-spatial-normal-save.json')==backup['sha256']
    ui=read('docs/contact-cloth-spatial-package-ui.json');assert not ui['console'] and ui['origin']=='http://127.0.0.1:53942'
    coords=[]
    for label in ['before','mobileHud']:
        t=ui[label];assert '群岛，再次相连' in t and 'progress indicator Value: 79, ID: hp' in t
        match=re.search(r'位置 X ([\d.-]+)，Z ([\d.-]+)；建筑 1；击败 3',t);assert match,label
        coords.append([float(n) for n in match.groups()])
    assert coords[0]==coords[1]==[round(backup['player']['x'],1),round(backup['player']['z'],1)]
    for label in ['desktopBag','mobileBag']:
        for item,count in [('木材',4),('石料',5),('纤维',6),('浆果',3),('贝壳',0),('晶石',0),('石斧',1),('晶石剑',0),('烤浆果',0)]:
            assert re.search(rf'text {item}\n\s+\d+ text {count}(?:\n|$)',ui[label]),(label,item)
    gpu={}
    for device,size in [('desktop',[1920,1080]),('mobile',[390,844])]:
        d=read(f'docs/contact-cloth-spatial-gpu-{device}.json');s=d['sample']
        assert not d['console'] and s['complete'] and s['supported'] and not s['hidden'] and s['disjointCount']==0
        assert s['viewport']==s['canvasBuffer']==size and len(s['rows'])==5
        assert all(r['gpuMs']['samples']==len(r['gpuRawMs'])==60 and r['gpuMs']['p95']<16.67 for r in s['rows'])
        gpu[device]=[r['gpuMs']['p95'] for r in s['rows']]
    d=read('docs/contact-cloth-spatial-endurance.json');s=d['sample']
    assert not d['console'] and d['archiveSha256']==p['archiveSha256'] and d['harnessSha256']==sha('tests/quality-spatial-endurance.html')
    assert s['complete'] and not s['hidden'] and s['targetMs']==600000 and 600000<=s['activeMs']<601000
    assert s['frames']>30000 and s['movingFraction']>.85 and s['respawns']==0 and s['p95Ms']<20
    assert len(s['stages'])==5 and all(x['distance']>30 for x in s['stages']) and s['hitCount']>0 and s['damageTaken']>0
    assert s['stepAttempts']==s['stepsScheduled'] and s['spatialAttempts']==s['spatialScheduled']>=4 and 0<s['pannersPeak']<=9
    assert s['settled']['voices']==0 and s['settled']['pannersCreated']==s['settled']['pannersReleased']>0
    assert len(s['checkpoints'])>=11 and all(c['glError']==0 and c['viewport']==[1920,1080] and c['canvasBuffer']==[1920,928] and c['audio']['voices']<=12 for c in s['checkpoints'])
    assert all(c['heapBytes'] is not None and c['heapBytes']>0 for c in s['checkpoints'])
    assert sha('dist/tidelands-m5-2026-10-17-grounding-budget-night.zip')=='23156d79fcac9f7905f730a40fa73cc2fdb76f8b6a2778f2415e24011a53e5ba'
    assert sha('docs/grounding-budget-night-normal-save.json')=='7a61b0ebbd67a8a9cd8e778b40148dea0d36acbddccb011c78ebfa971d05c4ce'
    images=[f'docs/contact-cloth-spatial-endurance-phase-{i}.jpg' for i in range(5)]+['docs/contact-cloth-spatial-normal-world.jpg','docs/contact-cloth-spatial-normal-mobile.jpg']
    assert all((ROOT/n).read_bytes().startswith(b'\xff\xd8\xff') for n in images)
    paths=['docs/'+NAME+'-verification.json','docs/contact-cloth-spatial-tests.txt','docs/contact-cloth-spatial-package-tests.txt','docs/spatial-audio-audit.json','docs/contact-cloth-spatial-backup-audit.json','docs/contact-cloth-spatial-normal-save.json','docs/contact-cloth-spatial-package-ui.json','docs/contact-cloth-spatial-gpu-desktop.json','docs/contact-cloth-spatial-gpu-mobile.json','docs/contact-cloth-spatial-endurance.json','tests/quality-spatial-endurance.html']+images
    report={'passed':True,'boundedBatchDelivered':True,'archive':p['archive'],'archiveSha256':p['archiveSha256'],'runtimeFiles':52,'sourceModules':32,'extractedPath':v['extractedPath'],'fullTests':241,'packageTests':4,'ordinaryBackup':backup,'ordinaryRestoredCoordinates':coords,'ordinarySaveRestored':True,'nativeStereoVerified':True,'mainLoopSpatialCueVerified':True,'equalPowerAcrossPanAccepted':False,'centerVsNearStereoEnergyDb':audio['centerVsNearStereoEnergyDb'],'gpuP95Ms':gpu,'endurance':{k:s[k] for k in ['activeMs','frames','movingFraction','distanceMeters','hitCount','damageTaken','respawns','p95Ms','maxMs','over50Ms','spatialAttempts','spatialScheduled','pannersPeak','settled']},'heapMiB':[round(c['heapBytes']/1048576,2) for c in s['checkpoints']],'imagesReviewed':images,'sourceSha256':{n:e['sha256'] for n,e in p['files'].items()},'evidenceSha256':{n:sha(n) for n in paths},'currentSourceLongRunAccepted':True,'currentFullJourneyReplayed':False,'physicalMobileDevice':False,'audioListened':False,'m5Complete':False,'fullGoalComplete':False,'limits':'Bounded contact/clothing/stereo batch, not complete visual or motion quality.600s declared teleport/sword/food/revived combat fixture includes real panner lifecycle and JS heap snapshots, no VRAM/leak freedom/phone/audition/native campaign proof. Existing ordinary q6 resumed/saved/downloaded/restored without repeated short-walk or new-game seed. Export is exact at download; subsequent no-input world time is not claimed identical entire state. Model toy feel, creature foot contact, dark faces and overall aesthetic gaps remain.'}
    (ROOT/'docs/contact-cloth-spatial-delivery-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['sourceSha256','evidenceSha256','imagesReviewed']},ensure_ascii=False))
if __name__=='__main__':verify()
