"""Verify the final combined local action package and its ordinary-save restore."""
import hashlib,json,re,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((ROOT/p).read_text())
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
NAME='tidelands-m5-2026-10-23-full-body-actions'
def verify():
 r=load('dist/'+NAME+'.json');v=load('docs/'+NAME+'-verification.json');old=load('dist/tidelands-m5-2026-10-23-low-gather.json')
 assert sha('dist/'+r['archive'])==r['archiveSha256']=='9a234a43d2977822caf62d3eb06057e7df9c2aad9d235a762e5c5acd4a7ba0ca'
 assert r['archiveBytes']==15060496 and len(r['files'])==93 and r['archiveEntries']==94 and v['passed'] and v['checkedFiles']==93
 assert r['builderSha256']==old['builderSha256'] and 'Ran 5 tests' in (ROOT/'docs/low-gather-package-tests.txt').read_text()
 changed=[p for p,e in r['files'].items() if old['files'][p]['sha256']!=e['sha256']]
 assert changed==['assets/characters/action-landmarks.json','src/authored-character.js']
 with zipfile.ZipFile(ROOT/'dist'/r['archive']) as archive:
  for p,e in r['files'].items():
   assert sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)==e['sha256'],p
   assert hashlib.sha256(archive.read('tidelands-local/'+p)).hexdigest()==e['sha256'],p
   assert hashlib.sha256((Path(v['extractedPath'])/p).read_bytes()).hexdigest()==e['sha256'],p
 a=load('docs/combat-body-audit.json');assert a['verified'] and not a['fullGoalComplete'] and a['currentExactSourceGpuAccepted']
 for p,h in a['files'].items():assert sha(p)==h,p
 ui=load('docs/combat-body-package-browser.json');assert not ui['console'] and ui['origin']=='http://127.0.0.1:59851'
 assert '位置 X 7.2，Z 53.5；建筑 1；击败 3' in ui['ax'] and 'progress indicator Value: 79, ID: hp' in ui['ax'] and '群岛，再次相连' in ui['ax']
 for name,count in [('木材',4),('石料',5),('纤维',6),('浆果',3),('石斧',1),('晶石剑',0)]:assert re.search(r'text '+name+r'\n\s+\d+ text '+str(count)+r'\n',ui['bagAx']),name
 assert (ROOT/'docs/combat-body-package-ordinary.jpg').read_bytes()[:2]==b'\xff\xd8'
 files=['docs/combat-body-package-browser.json','docs/combat-body-package-ordinary.jpg','docs/'+NAME+'-verification.json','docs/combat-body-audit.json','docs/low-gather-package-tests.txt']
 result={'verified':True,'boundedCombinedActionsDelivered':True,'archive':r['archive'],'archiveBytes':r['archiveBytes'],'archiveSha256':r['archiveSha256'],'runtimeInputs':93,'archiveEntries':94,'extractedPath':v['extractedPath'],'changedFromLowGather':changed,'currentExactSourceGpuAccepted':True,'currentExactSourceEnduranceAccepted':False,'ordinaryCurrentPackageRestored':True,'ordinaryNewJsonDownloaded':False,'ordinaryNewSaveOrMobileReloadTested':False,'fullMotionQualityAccepted':False,'milestoneM5Complete':False,'fullGoalComplete':False,'scope':'Final combined source/ZIP/extraction93 hashes, current combat/hurt/miss/390/GPU fixtures plus existing ordinary q6 desktop restore and bag. Previous635 low-gather native/main evidence remains pinned to its original source; current9 low-gather regressions are in300 passing tests. Packaging5 tests reused only because builder unchanged. No new final-package save390 or campaign replay, exact mesh contact, endurance, device/audition/VRAM or full naturalness.','files':{p:sha(p) for p in files}}
 (ROOT/'docs/combat-body-delivery-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result
if __name__=='__main__':
 r=verify();print(json.dumps({k:v for k,v in r.items() if k!='files'},ensure_ascii=False,indent=2))
