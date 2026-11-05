"""Collect and check the ordinary-input movement observation; not M5 acceptance."""
import argparse,hashlib,json,math,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'dist/movement-native-2026-11-05';E=ROOT/'docs/movement-native-2026-11-05'
def load(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def verify(collect=False):
 r=load(RAW/'raw.json');o=load(RAW/'observation.json');rows=o['rows']
 assert r['complete'] and r['reloadExact'] and r['respawns']==0 and not r['logs'] and not r.get('error')
 assert sha(RAW/'observation.json')==r['observationSha256'] and len(rows)==r['observedFrames']
 assert r['initialSaveSha256']==sha(ROOT/'docs/bedrock-delivery-2026-11-05/native-final-save.json')
 assert r['initialProfileSha256']==sha(ROOT/'dist/bedrock-native-campaign-2026-11-05/browser-state.json')
 assert sha(ROOT/'tools/observe_movement_scene.js')==r['observerSha256']
 assert r['packageSha256']==sha(ROOT/'dist/tidelands-m5-2026-11-05-bedrock.zip')=='b1900ba4c824a8d244892b3db37caa15cbda77ce51c089adea444116e584be31'
 assert len(r['phases'])==4 and all(p['quest']==6 and p['ui']['glError']==0 and not p['ui']['hidden'] for p in r['phases'])
 for p in r['phases']:assert sha(RAW/p['image'])==p['imageSha256'] and sha(RAW/p['save'])==p['saveSha256']
 assert r['phases'][2]['inventory']['crystal']==r['phases'][0]['inventory']['crystal']+1
 final=load(RAW/'final-save.json');assert final['quest']==6 and final['kills']>r['phases'][0]['kills'] and final['player']['hp']==100
 assert final['buildings']==r['phases'][0]['buildings'];assert sha(RAW/r['video'])==r['videoSha256']
 profile=load(RAW/'browser-state.json');saved=next(v['value'] for origin in profile['origins'] for v in origin['localStorage'] if v['name']=='tidelands-save-v1');assert saved==(RAW/'final-save.json').read_text()
 pairs=[(i,a,b) for i,(a,b) in enumerate(zip(rows,rows[1:]),1) if 0<b[0]-a[0]<=.06]
 angles=[(abs(math.atan2(math.sin(math.atan2(b[5]-b[1],b[7]-b[2])-math.atan2(a[5]-a[1],a[7]-a[2])),math.cos(math.atan2(b[5]-b[1],b[7]-b[2])-math.atan2(a[5]-a[1],a[7]-a[2])))),i) for i,a,b in pairs]
 max_angle,index=max(angles);land=[b for b in rows if b[3]>=.15];contact_gaps=[b[10+j] for b in land for j in [0,1] if b[12+j]];contact_errors=[b[14+j] for b in land for j in [0,1] if b[12+j]]
 summary={'observedFrames':len(rows),'gameSeconds':rows[-1][0]-rows[0][0],'observedPathMetres':sum(math.hypot(b[1]-a[1],b[2]-a[2]) for _,a,b in pairs),'maxGroundDropPerFrame':max(a[3]-b[3] for _,a,b in pairs),'maxCameraYawStepDegrees':max_angle*180/math.pi,'maxCameraYawStepFrame':index,'cameraStepsOver45Degrees':sum(a>math.pi/4 for a,_ in angles),'landContactMinSoleMarkerGap':min(contact_gaps),'landContactMaxTargetError':max(contact_errors),'landContactSamplesOver10cmTargetError':sum(e>.1 for e in contact_errors),'finalQuest':final['quest'],'finalKills':final['kills'],'finalHp':final['player']['hp'],'finalInventory':final['inventory'],'finalSaveSha256':sha(RAW/'final-save.json'),'rawObservationSha256':sha(RAW/'observation.json'),'nativeVideoSha256':r['videoSha256'],'inputsSha256':sha(RAW/'inputs.jsonl'),'m5Complete':False,'fullGoalComplete':False,'sourceSha256':{p:sha(ROOT/p) for p in ['src/camera.js','src/scene.js','src/world.js','src/authored-character.js','tools/observe_movement_scene.js','tools/run_movement_native_review.mjs','tools/verify_movement_native.py']}}
 if collect:
  E.mkdir(exist_ok=True)
  for p in [RAW/'raw.json',RAW/'final-save.json',*map(lambda row:RAW/row['save'],r['phases'])]:shutil.copyfile(p,E/p.name)
  (E/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
 else:
  assert load(E/'summary.json')==summary and sha(E/'raw.json')==sha(RAW/'raw.json') and sha(E/'final-save.json')==sha(RAW/'final-save.json')
 print(json.dumps({k:summary[k] for k in ['observedFrames','gameSeconds','observedPathMetres','maxGroundDropPerFrame','maxCameraYawStepDegrees','cameraStepsOver45Degrees','landContactMinSoleMarkerGap','landContactMaxTargetError','landContactSamplesOver10cmTargetError','finalKills','finalHp']}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--collect',action='store_true');verify(p.parse_args().collect)
