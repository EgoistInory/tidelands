"""Frozen local delivery audit; explicitly separate bounded work from full M5/3A."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-18-beacon-footing'
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()

p=read('dist/'+NAME+'.json');v=read('docs/'+NAME+'-verification.json')
assert v['passed'] and v['checkedFiles']==53 and v['archiveEntries']==54
assert sha('dist/'+p['archive'])==p['archiveSha256']=='2d922da8581be03234e0b721cf7f5561b8d0612a5093ac55f82b5330b33ae5ca'
with zipfile.ZipFile(ROOT/'dist'/p['archive']) as z:
    assert z.testzip() is None
    for name,entry in p['files'].items():
        assert sha('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)==entry['sha256'],name
        assert hashlib.sha256(z.read('tidelands-local/'+name)).hexdigest()==entry['sha256']
        assert hashlib.sha256((Path(v['extractedPath'])/name).read_bytes()).hexdigest()==entry['sha256']
assert '# tests 247\n' in (ROOT/'docs/creature-footing-full-tests.txt').read_text()
assert '# fail 0\n' in (ROOT/'docs/creature-footing-full-tests.txt').read_text()
assert 'Ran 4 tests' in (ROOT/'docs/beacon-footing-package-tests.txt').read_text()
assert read('docs/creature-footing-audit.json')['boundedCreatureFootingAccepted']
assert read('docs/beacon-footing-gpu-audit.json')['currentSourceFullCanvasGpuAccepted']
backup=read('docs/beacon-footing-backup-audit.json');ui=read('docs/beacon-footing-package-ui.json')
assert backup['passed'] and backup['allFieldsPreserved'] and backup['quest']==6 and backup['kills']==3 and backup['player']['hp']==79
assert sha('docs/beacon-footing-normal-save.json')==backup['sha256']
assert not ui['console'] and ui['origin']=='http://127.0.0.1:53942'
coords=[]
for label in ['before','mobileHud']:
    text=ui[label];assert '群岛，再次相连' in text and 'progress indicator Value: 79, ID: hp' in text
    match=re.search(r'位置 X ([\d.-]+)，Z ([\d.-]+)；建筑 1；击败 3',text);assert match,label
    coords.append([float(n) for n in match.groups()])
assert coords[0]==coords[1]==[round(backup['player']['x'],1),round(backup['player']['z'],1)]
for label in ['desktopBag','mobileBag']:
    for item,count in [('木材',4),('石料',5),('纤维',6),('浆果',3),('贝壳',0),('晶石',0),('石斧',1),('晶石剑',0),('烤浆果',0)]:
        assert re.search(rf'text {item}\n\s+\d+ text {count}(?:\n|$)',ui[label]),(label,item)
d=read('docs/beacon-footing-endurance.json');s=d['sample']
assert not d['console'] and d['archiveSha256']==p['archiveSha256'] and d['harnessSha256']==sha('tests/quality-spatial-endurance.html')
assert s['complete'] and not s['hidden'] and s['targetMs']==600000 and 600000<=s['activeMs']<601000
assert s['frames']>30000 and s['movingFraction']>.85 and s['respawns']==0 and s['p95Ms']<20
assert len(s['stages'])==5 and all(row['distance']>30 for row in s['stages']) and s['hitCount']>0 and s['damageTaken']>0
assert s['stepAttempts']==s['stepsScheduled'] and s['spatialAttempts']==s['spatialScheduled']>=4
assert s['settled']['voices']==0 and s['settled']['pannersCreated']==s['settled']['pannersReleased']>0
assert len(s['checkpoints'])>=11 and all(c['glError']==0 and c['viewport']==[1920,1080] and c['canvasBuffer']==[1920,928] and c['audio']['voices']<=12 and c['heapBytes']>0 for c in s['checkpoints'])
assert sha('dist/tidelands-m5-2026-10-18-contact-cloth-spatial.zip')=='e14e48651558f35395b1d2d8d2be7aa065d56ef339b4641f4edd26359d0da87a'
assert sha('docs/contact-cloth-spatial-normal-save.json')=='0642bbf2b456065babfe288dc8c5ae3b95c8520af8e8625ebbaaca2c2c4b236b'
images=sorted(str(f.relative_to(ROOT)) for f in (ROOT/'docs').glob('beacon-footing-endurance-phase-*.jpg'))+['docs/beacon-footing-normal-world.jpg','docs/beacon-footing-normal-mobile.jpg']
assert len(images)>=4 and all((ROOT/n).read_bytes().startswith(b'\xff\xd8\xff') for n in images)
report=dict(passed=True,boundedBatchDelivered=True,archive=p['archive'],archiveSha256=p['archiveSha256'],runtimeFiles=53,sourceModules=33,
            extractedPath=v['extractedPath'],fullTests=247,packageTests=4,ordinaryBackup=backup,ordinaryRestoredCoordinates=coords,
            currentSourceLongRunAccepted=True,currentSourceFullCanvasGpuAccepted=True,ordinarySaveRestored=True,
            currentFullJourneyReplayed=False,physicalMobileDevice=False,audioListened=False,m5Complete=False,fullGoalComplete=False,
            gpu=read('docs/beacon-footing-gpu-audit.json')['devices'],
            endurance={k:s[k] for k in ['activeMs','frames','movingFraction','distanceMeters','hitCount','damageTaken','respawns','p95Ms','maxMs','over50Ms','spatialAttempts','spatialScheduled','pannersPeak','settled']},
            heapMiB=[round(c['heapBytes']/1048576,2) for c in s['checkpoints']],imagesReviewed=images,
            sourceSha256={n:e['sha256'] for n,e in p['files'].items()},
            limits='Bounded beam/creature-footing delivery; endpoints are not whole soles or natural body motion. Declared teleport/sword/food/revived combat load; no VRAM/leak freedom/audition/real phone/native campaign proof. Only captured long-run phases have image evidence. Existing q6 resumed/exported/restored; no new-game or short-walk replay. Model toy feel, complete motion and aesthetic gaps remain.')
(ROOT/'docs/beacon-footing-delivery-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['passed','boundedBatchDelivered','archiveSha256','fullTests','currentSourceLongRunAccepted','m5Complete','fullGoalComplete']}))
