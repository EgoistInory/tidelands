"""Verify the bounded camera fix and local delivery; full M5/3A stays open."""
import argparse,hashlib,json,math,shutil,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'docs/camera-orbit-2026-11-05'
NAME='tidelands-m5-2026-11-05-camera-orbit-r2';DIGEST='79c84f319f64b6cf5b06c9597cdf002ea95ca5c069b8b64f042cd0e032bc7e65'
def load(p):return json.loads(p.read_text())
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def verify(collect=False):
 m=load(ROOT/'dist'/(NAME+'.json'));archive=ROOT/'dist'/(NAME+'.zip');assert sha(archive)==m['archiveSha256']==DIGEST and archive.stat().st_size==170927269
 assert len(m['files'])==211
 old=load(ROOT/'dist/tidelands-m5-2026-11-05-bedrock.json');assert set(m['files'])==set(old['files'])
 assert {p for p in m['files'] if m['files'][p]['sha256']!=old['files'][p]['sha256']}=={'README.md','src/camera.js','src/scene.js'}
 with zipfile.ZipFile(archive) as z:
  assert len(z.namelist())==212 and z.testzip() is None
  for p,v in m['files'].items():
   assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if p=='README.md' else p))==v['sha256'],p
   assert hashlib.sha256(z.read('tidelands-local/'+p)).hexdigest()==v['sha256'],p
   assert sha(ROOT/'dist'/NAME/'tidelands-local'/p)==v['sha256'],p
 assert sha(ROOT/'dist/tidelands-m5-2026-11-05-bedrock.zip')=='b1900ba4c824a8d244892b3db37caa15cbda77ce51c089adea444116e584be31'
 assert sha(ROOT/'dist/tidelands-m5-2026-11-05-camera-orbit.zip')=='7a4b1a139742d382876ca7fed02317d8b89e329fb6930fce219dc18d8c2cf17c'
 cases=[]
 for folder in ['camera-orbit-r2-new-field-pose-2026-11-05','camera-orbit-r2-mobile-field-pose-2026-11-05']:
  d=ROOT/'dist'/folder;r=load(d/'raw.json');c=r['case'];assert r['complete'] and not r['logs'] and not r.get('error')
  assert c['glError']==0 and c['authored'] and c['capturedPoseApplied'] and r['initialFarFov']==55
  assert c['projectedBounds']['vertices']==19253 and min(c['projectedBounds']['min'])>-1 and max(c['projectedBounds']['max'])<1
  for im in r['images']:assert sha(d/im['image'])==im['sha256']
  def bearing(p):return math.atan2(p[0]-c['focus'][0],p[2]-c['focus'][2])
  step=abs(math.atan2(math.sin(bearing(c['actual'])-bearing(c['current'])),math.cos(bearing(c['actual'])-bearing(c['current']))))*180/math.pi
  assert step<45
  assert not any(all(b['min'][i]<=c['actual'][i]<=b['max'][i] for i in range(3)) for b in c['boxes'])
  cases.append({'folder':folder,'width':r['width'],'fixedFocusOrbitDegrees':step,'fov':c['cameraFov'],'projectedBounds':c['projectedBounds'],'rawSha256':sha(d/'raw.json')})
 d=ROOT/'dist/camera-orbit-r2-native-2026-11-05';r=load(d/'raw.json');o=load(d/'observation.json');rows=o['rows']
 assert r['complete'] and r['reloadExact'] and not r['logs'] and not r.get('error') and r['respawns']==0 and r['packageSha256']==DIGEST
 assert sha(d/'observation.json')==r['observationSha256'] and len(rows)==r['observedFrames']
 assert sha(ROOT/'tools/observe_camera_orbit.js')==r['observerSha256']
 prior=ROOT/'dist/camera-orbit-native-2026-11-05';assert sha(prior/'browser-state.json')==r['initialProfileSha256'] and sha(prior/'final-save.json')==r['initialSaveSha256']
 assert len(r['phases'])==4 and all(p['quest']==6 and not p['ui']['hidden'] and p['ui']['glError']==0 for p in r['phases'])
 for p in r['phases']:assert sha(d/p['save'])==p['saveSha256'] and sha(d/p['image'])==p['imageSha256']
 final=load(d/'final-save.json');assert final['quest']==6 and final['player']['hp']==100 and final['buildings']==r['phases'][0]['buildings']
 assert final['inventory']['crystal']==r['phases'][0]['inventory']['crystal']+1
 saved=next(v['value'] for origin in load(d/'browser-state.json')['origins'] for v in origin['localStorage'] if v['name']=='tidelands-save-v1');assert saved==(d/'final-save.json').read_text()
 assert sha(d/r['video'])==r['videoSha256']
 pairs=[(a,b) for a,b in zip(rows,rows[1:]) if 0<b[0]-a[0]<=.06];angles=[];orientations=[]
 for a,b in pairs:
  ya=math.atan2(a[5]-a[1],a[7]-a[2]);yb=math.atan2(b[5]-b[1],b[7]-b[2]);angles.append(abs(math.atan2(math.sin(yb-ya),math.cos(yb-ya))))
  orientations.append(2*math.acos(min(1,abs(sum(x*y for x,y in zip(a[20:24],b[20:24]))))))
 cd=ROOT/'dist/camera-orbit-r2-save-compat-2026-11-05';compat=load(cd/'raw.json');assert compat['complete'] and len(compat['rows'])==3 and not compat.get('error')
 assert '/'+NAME+'/tidelands-local/' in compat['entry'] and '/'+NAME+'/tidelands-local/' in r['entry']
 for p,v in compat['sources'].items():assert sha(ROOT/p)==v
 for row in compat['rows']:
  assert row['reloadExact'] and not row['logs'] and row['moved']>.5 and row['layout']['width']==row['layout']['scrollWidth']==row['width'] and row['layout']['glError']==0
  for im in row['images']:assert sha(cd/im['image'])==im['sha256']
  assert sha(cd/(row['name']+'-save.json'))==row['saveSha256']
 combat_dir=ROOT/'dist/camera-orbit-r2-combat-2026-11-05';combat=load(combat_dir/'raw.json');assert combat['complete'] and combat['reloadExact'] and not combat['logs'] and not combat.get('error') and combat['respawns']==0
 assert combat['initialProfileSha256']==sha(d/'browser-state.json') and combat['initialSaveSha256']==sha(d/'final-save.json') and combat['packageSha256']==DIGEST
 assert len(combat['phases'])==3 and combat['final']['kills']>combat['phases'][0]['kills'] and combat['final']['player']['hp']==100 and combat['final']['quest']==6
 assert next(e for e in combat['final']['enemies'] if e['id']==combat['targetEnemy'])['hp']<=0
 combat_saved=next(v['value'] for origin in load(combat_dir/'browser-state.json')['origins'] for v in origin['localStorage'] if v['name']=='tidelands-save-v1');assert combat_saved==(combat_dir/'final-save.json').read_text() and load(combat_dir/'final-save.json')==combat['final']
 for row in combat['phases']:assert sha(combat_dir/row['image'])==row['imageSha256'] and sha(combat_dir/row['save'])==row['saveSha256'] and row['ui']['glError']==0
 assert sha(combat_dir/combat['video'])==combat['videoSha256']
 assert '# pass 419' in (E/'r2-full-tests.txt').read_text() and '# fail 0' in (E/'r2-full-tests.txt').read_text()
 assert '# fail 1' in (E/'red.txt').read_text() and '# fail 1' in (E/'second-case-red.txt').read_text()
 summary={'runtimePackage':NAME,'archiveSha256':DIGEST,'bytes':archive.stat().st_size,'runtimeInputs':211,'archiveEntries':212,'ruleTests':419,'packagingTestsObserved':7,'cases':cases,'observedFrames':len(rows),'gameSeconds':rows[-1][0]-rows[0][0],'pathMetres':sum(math.hypot(b[1]-a[1],b[2]-a[2]) for a,b in pairs),'maxNativeOrbitDegrees':max(angles)*180/math.pi,'nativeOrbitStepsOver45Degrees':sum(x>math.pi/4 for x in angles),'maxNativeOrientationDegrees':max(orientations)*180/math.pi,'nativeFovRange':[min(p[24] for p in rows),max(p[24] for p in rows)],'finalQuest':final['quest'],'finalKills':final['kills'],'finalHp':final['player']['hp'],'finalTime':final['time'],'finalInventory':final['inventory'],'finalSaveSha256':sha(d/'final-save.json'),'profileSha256':sha(d/'browser-state.json'),'observationSha256':r['observationSha256'],'nativeVideo':r['video'],'nativeVideoSha256':r['videoSha256'],'inputsSha256':sha(d/'inputs.jsonl'),'fullGoalComplete':False,'m5Complete':False,'globalCameraNaturalnessAccepted':False,'gpuEnduranceAccepted':False,'physicalDeviceAccepted':False,'audioListened':False,'wholeVideoReviewed':False,'sourceSha256':{p:sha(ROOT/p) for p in ['src/camera.js','src/scene.js','tests/camera-native-step.test.js','tools/capture_native_camera_case.mjs','tools/observe_camera_orbit.js','tools/run_camera_orbit_r2_journey.mjs','tools/run_camera_orbit_r2_combat.mjs','tools/run_camera_orbit_r2_save_compat.mjs','tools/summarize_camera_orbit.py','tools/verify_camera_orbit_delivery.py']}}
 summary['combat']={'enemy':combat['targetEnemy'],'initialKills':combat['phases'][0]['kills'],'finalKills':combat['final']['kills'],'finalHp':combat['final']['player']['hp'],'finalInventory':combat['final']['inventory'],'finalSaveSha256':sha(combat_dir/'final-save.json'),'profileSha256':sha(combat_dir/'browser-state.json'),'video':combat['video'],'videoSha256':combat['videoSha256']}
 assert '# fail 2' in (E/'remaining-red.txt').read_text(),'Known camera failure must remain explicit'
 if collect:
  for p in [d/'raw.json',d/'final-save.json',*map(lambda x:d/x['save'],r['phases'])]:shutil.copyfile(p,E/('r2-native-'+p.name))
  shutil.copyfile(cd/'raw.json',E/'r2-compat-raw.json');shutil.copyfile(prior/'raw.json',E/'r1-native-raw.json')
  for c in cases:shutil.copyfile(ROOT/'dist'/c['folder']/'raw.json',E/(c['folder']+'-raw.json'))
  for p in [combat_dir/'raw.json',combat_dir/'final-save.json',*map(lambda x:combat_dir/x['save'],combat['phases'])]:shutil.copyfile(p,E/('r2-combat-'+p.name))
  (E/'audit.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 else:
  assert load(E/'audit.json')==summary and sha(E/'r2-native-final-save.json')==summary['finalSaveSha256'] and sha(E/'r2-native-raw.json')==sha(d/'raw.json')
  assert sha(E/'r2-combat-final-save.json')==summary['combat']['finalSaveSha256']
 print(json.dumps({**{k:summary[k] for k in ['ruleTests','observedFrames','gameSeconds','pathMetres','maxNativeOrbitDegrees','nativeOrbitStepsOver45Degrees','globalCameraNaturalnessAccepted','fullGoalComplete']},'latestCombatKills':summary['combat']['finalKills'],'remainingExperimentFailures':2}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--collect',action='store_true');verify(p.parse_args().collect)
