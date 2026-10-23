"""Check the finite local pickup delivery; no implied performance/full-game acceptance."""
import hashlib,json,re,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((ROOT/p).read_text())
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
NAME='tidelands-m5-2026-10-23-low-gather'
def verify():
 r=load('dist/'+NAME+'.json');v=load('docs/'+NAME+'-verification.json');old=load('dist/tidelands-m5-2026-10-23-motion-impact-r2.json')
 assert r['archiveSha256']=='63501f1a6b641985928aefe6ea5fb3ddc82c13a96f6674f4f31af062aed2a3b8' and r['archiveBytes']==15060172
 assert sha('dist/'+r['archive'])==r['archiveSha256'] and len(r['files'])==93 and r['archiveEntries']==94
 assert v['passed'] and v['checkedFiles']==93 and v['archiveSha256']==r['archiveSha256']
 changed=[p for p,e in r['files'].items() if old['files'].get(p,{}).get('sha256')!=e['sha256']]
 assert set(changed)=={'README.md','assets/characters/action-landmarks.json','src/authored-character.js','src/main.js','src/scene.js'}
 with zipfile.ZipFile(ROOT/'dist'/r['archive']) as archive:
  for path,e in r['files'].items():
   assert sha('docs/LOCAL-DELIVERY.md' if path=='README.md' else path)==e['sha256'],path
   assert hashlib.sha256(archive.read('tidelands-local/'+path)).hexdigest()==e['sha256'],path
   assert hashlib.sha256((Path(v['extractedPath'])/path).read_bytes()).hexdigest()==e['sha256'],path
 a=load('docs/low-gather-audit.json');assert a['verified'] and not a['milestoneM5Complete'] and not a['fullGoalComplete']
 for p,d in a['files'].items():assert sha(p)==d,p
 ui=load('docs/low-gather-package-browser.json');assert ui['origin']=='http://127.0.0.1:59851' and not ui['console']
 for field in ['beforeAx','mobileRestoreAx']:
  assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ui[field]
  assert 'progress indicator Value: 79, ID: hp' in ui[field] and '群岛，再次相连' in ui[field]
 assert '存档已保存。' in ui['savedAx']
 for name,count in [('木材',4),('石料',5),('纤维',6),('浆果',3),('石斧',1),('晶石剑',0)]:assert re.search(r'text '+name+r'\n\s+\d+ text '+str(count)+r'\n',ui['bagAx']),name
 assert 'Ran 5 tests' in (ROOT/'docs/low-gather-package-tests.txt').read_text()
 files=['docs/low-gather-package-browser.json','docs/low-gather-package-desktop.jpg','docs/low-gather-package-mobile.jpg','docs/low-gather-package-tests.txt','docs/'+NAME+'-verification.json','docs/low-gather-audit.json']
 for p in files:
  if p.endswith('.jpg'):assert (ROOT/p).read_bytes()[:2]==b'\xff\xd8'
 result={'verified':True,'boundedLocalDeliveryVerified':True,'archive':r['archive'],'archiveBytes':r['archiveBytes'],'archiveSha256':r['archiveSha256'],'runtimeInputs':93,'archiveEntries':94,'extractedPath':v['extractedPath'],'changedFromPrevious':changed,'ordinaryUiCoordinates':'X7.2 Z53.5 / HP79 / quest6 / camp1 / kills3','ordinaryNewJsonDownloaded':False,'currentExactSourceGpuAccepted':False,'currentExactSourceEnduranceAccepted':False,'fullMotionQualityAccepted':False,'milestoneM5Complete':False,'fullGoalComplete':False,'scope':'Bounded full-body low-resource pickup / near proxy contact, main native E success/pause cancellation and independent ordinary restore/save390. No new ordinary campaign/gather/movement or JSON export here; old600s/GPU remain historical. Device/audition/naturalness/far-node exact contact remain pending.','files':{p:sha(p) for p in files}}
 (ROOT/'docs/low-gather-delivery-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result
if __name__=='__main__':
 r=verify();print(json.dumps({k:v for k,v in r.items() if k!='files'},ensure_ascii=False,indent=2))
