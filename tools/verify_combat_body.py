"""Audit the bounded grounded combat animation candidate and its real main-loop fixtures."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
load=lambda p:json.loads((ROOT/p).read_text())
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
 rows=load('docs/combat-body-main-browser.json');by={r['name']:r['data'] for r in rows}
 assert set(by)=={'sword-crab-main','boar-hurt-main','axe-boar-main','hand-crab-desktop-initial','sword-miss-recovery-main','hand-crab-mobile-main'}
 for r in rows:
  d=r['data'];assert d['paused'] and d['authored'] and d['glError']==0 and not r['console']
  for p,h in d['sources'].items():assert sha(p)==h,p
 for name,hp,weapon in [('sword-crab-main',2,'sword'),('axe-boar-main',17,'axe'),('hand-crab-mobile-main',28,'hand')]:
  d=by[name];assert d['targetHp']==hp and d['hp']==100 and d['weapon']==weapon and len(d['events'])==1
  assert d['plan']['action']=='attack' and .5<=d['plan']['actionProgress']<.6 and d['plan']['equipped']==weapon
  assert [s['kind'] for s in d['sounds']]==['swing','hit'] and all(s['context']=='running' and s['after']>s['before'] for s in d['sounds'])
  assert d['events'][0]['time']==d['sounds'][1]['time']
  assert len(d['poses'])>5 and all(len(p['feet'])==2 for p in d['poses'])
  if weapon!='hand':assert max(p['pelvis'][1] for p in d['poses'])-min(p['pelvis'][1] for p in d['poses'])>.2
 assert by['hand-crab-mobile-main']['viewport']==[390,844]
 assert by['hand-crab-desktop-initial']['viewport']==[1280,720]  # Retain the rejected mobile attempt honestly.
 hurt=by['boar-hurt-main'];assert hurt['hp']==88 and hurt['targetHp']==40 and not hurt['events'] and hurt['plan']['action'] is None
 assert hurt['hurtSource']['name']=='Hit_Chest' and .3<hurt['hurtSource']['phase']<.7
 assert [s['kind'] for s in hurt['sounds']]==['hit']
 miss=by['sword-miss-recovery-main'];assert miss['hp']==100 and not miss['events'] and miss['actionSource'] is None and [s['kind'] for s in miss['sounds']]==['swing']
 for filename,count in [('combat-body-focused',27),('combat-body-full-tests',300)]:
  log=(ROOT/('docs/'+filename+'.txt')).read_text();assert f'# pass {count}\n' in log and '# fail 0\n' in log
 red=(ROOT/'docs/combat-body-red.txt').read_text();assert '# fail 7\n' in red and 'authored lower-body rotation was discarded' in red and "'Hit_Chest'" in red
 cpu=load('docs/combat-body-world-cpu.json');assert len(cpu['rows'])==36 and sum(r['frames'] for r in cpu['rows'])==8424
 assert max(r['maxError'] for r in cpu['rows'])<.003 and not sum(r['respawns'] for r in cpu['rows'])
 for p,h in cpu['files'].items():assert sha(p)==h,p
 before=load('docs/combat-tool-before.json');after=load('assets/characters/action-landmarks.json')
 assert after['rows']['Sword_Attack']['weaponForwardPhase']==before['rows']['Sword_Attack']['weaponForwardPhase']
 assert after['toolCalibration']['upperBodyRows']==before['toolCalibration']['rows']
 assert after['toolCalibration']['sourceSha256']==sha('src/authored-character.js')
 assert after['rows']['Sword_Attack']['groundedWeaponForwardPhase']=={'axe':34/120,'sword':34/120}
 gpu=load('docs/combat-body-gpu.json');assert [r['label'] for r in gpu]==['desktop','mobile']
 for d,size in zip(gpu,[[1920,1080],[390,844]]):
  assert d['complete'] and d['authored'] and d['viewport']==d['buffer']==size and d['peak']==48 and not d['hidden'] and not d['disjoint'] and not d['console'] and d['glError']==0
  for p,h in d['sources'].items():assert sha(p)==h,p
  assert [r['stage'] for r in d['rows']]==['shore','forest','highland','shoal','night-camp']
  for r in d['rows']:
   assert len(r['gpuRawMs'])==60 and all(n>0 for n in r['gpuRawMs']) and r['gpuMs']['p95']<20
   assert r['poolActive']==48 and r['action']['name']=='Sword_Attack' and r['hurt']['name']=='Hit_Chest'
   assert abs(r['action']['gameProgress']-.5)<.001 and abs(r['hurt']['phase']-.4)<.001
  if d['label']=='mobile':assert d['release']['active']==0 and d['release']['before']['geometries']-d['release']['after']['geometries']==1 and d['release']['before']['textures']==d['release']['after']['textures']
  else:assert 'release' not in d  # Desktop DOM was read before its release report updated; no release claim.
 prior=load('dist/tidelands-m5-2026-10-23-low-gather.json');changed=[]
 for p,h in prior['files'].items():
  if sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)!=h['sha256']:changed.append(p)
 assert changed==['assets/characters/action-landmarks.json','src/authored-character.js']
 assert sha('dist/tidelands-m5-2026-10-23-low-gather.zip')==prior['archiveSha256']=='63501f1a6b641985928aefe6ea5fb3ddc82c13a96f6674f4f31af062aed2a3b8'
 assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
 images=['sword-crab','boar-hurt','axe-boar','hand-desktop-initial','miss-recovered','hand-mobile','gpu-desktop','gpu-mobile']
 files=['docs/combat-body-'+n+'.jpg' for n in images]
 for p in files:assert (ROOT/p).read_bytes()[:2]==b'\xff\xd8',p
 files+=['docs/combat-body-main-browser.json','docs/combat-body-gpu.json','docs/combat-body-focused.txt','docs/combat-body-full-tests.txt','docs/combat-body-focused-initial.txt','docs/combat-body-full-tests-initial.txt','docs/combat-body-red.txt','docs/combat-body-world-cpu.json','docs/combat-source-poses.json','docs/combat-tool-before.json','tests/authored-combat-body.test.js','tests/combat-body-main-review.html','tests/combat-body-budget-review.html','tools/probe_combat_source.mjs','tools/calibrate_authored_tools.mjs','src/authored-character.js','assets/characters/action-landmarks.json']
 result={'verified':True,'boundedCombatBodyCandidateAccepted':True,'packaged':False,'focusedTests':27,'fullTests':300,'changedRuntimeInputs':changed,'currentExactSourceGpuAccepted':True,'currentExactSourceEnduranceAccepted':False,'releaseEvidenceMobileOnly':True,'fullMotionQualityAccepted':False,'milestoneM5Complete':False,'fullGoalComplete':False,'gpuP95Ms':{d['label']:[r['gpuMs']['p95'] for r in d['rows']] for d in gpu},'scope':'Stationary grounded full-body strikes and real Hit_Chest; moving/deep-swimming retain lower-body locomotion. Native main/space confirms sword38/axe23/hand12 and real boar12 hurt, sound dispatch, no false hit on miss. First hand mobile attempt actually1280: retained as desktop and corrected390 sampled. Desktop release report was not captured; only mobile release metadata accepted. GPU forces attack+hurt+48debris each frame in five teleported stages; not normal campaign, device/audition/VRAM, exact mesh contact, endurance or final naturalness. Current source differs from delivered635 only actor and markers; ordinary save and package unmodified.','files':{p:sha(p) for p in files}}
 (ROOT/'docs/combat-body-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result
if __name__=='__main__':
 r=verify();print(json.dumps({k:v for k,v in r.items() if k!='files'},ensure_ascii=False,indent=2))
