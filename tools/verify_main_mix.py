"""Verify actual-main recordings, not offline synthesis or final sound quality."""
import argparse,hashlib,json,shutil,subprocess,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1];E=R/'docs/main-mix-2026-11-05'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def main(collect):
 subprocess.run([sys.executable,str(R/'tools/verify_runtime_ceiling.py')],cwd=R,stdout=subprocess.DEVNULL,check=True)
 if collect:E.mkdir(exist_ok=True)
 rows=[]
 for mode in ['camp','combat']:
  d=R/f'dist/main-mix-2026-11-05-{mode}';r=load(d/'raw.json');a=load(d/'pcm-analysis.json');mix=r['mix']
  assert r['complete'] and r['reloadExact'] and not r['logs'] and not r.get('error') and r['respawns']==0
  assert r['observerSha256']==sha(R/'tools/observe_main_mix.js') and r['packageSha256']=='79c84f319f64b6cf5b06c9597cdf002ea95ca5c069b8b64f042cd0e032bc7e65'
  assert r['initialProfileSha256']==sha(R/'dist/runtime-ceiling-2026-11-05-desktop/browser-state.json') and r['initialSaveSha256']==sha(R/'docs/runtime-ceiling-2026-11-05/desktop-final-save.json')
  assert r['historicalSaveSha256']==sha(R/'dist/runtime-ceiling-2026-11-05-desktop/02-highland-gather-save.json')
  assert not mix['errors'] and mix['pending']==0 and not mix['recording'] and mix['peakPending']<=4 and mix['bytes']==(d/'main-mix.webm').stat().st_size
  assert a['channels']==2 and a['sampleRate']==48000 and a['full']['peak']>0 and a['full']['clipped']==0 and abs(a['durationDeltaSeconds'])<.3
  for name in ['pause','muted']:assert a['windows'][name]['rms']<a['windows']['ambient']['rms']*.001
  assert a['windows']['resumed']['rms']>a['windows']['ambient']['rms']*.1
  assert sha(d/'main-mix.webm')==r['audioSha256']==a['originalSha256'] and sha(d/r['video'])==r['videoSha256'] and sha(d/'review-12s.wav')==a['preview']['sha256']
  for p in r['phases']:assert p['ui']['glError']==0 and not p['ui']['hidden'] and sha(d/p['image'])==p['imageSha256']
  final=load(d/'final-save.json');assert final==r['final'] and final['quest']==6 and final['kills']==20 and final['player']['hp']==100
  assert next(v['value'] for o in load(d/'browser-state.json')['origins'] for v in o['localStorage'] if v['name']=='tidelands-save-v1')==(d/'final-save.json').read_text()
  counts={k:sum(v.get('kind')==k and v.get('after',0)>v.get('before',0) for v in mix['events']) for k in ['step','gather','swing','hit','hurt','enemy-windup','food']}
  assert counts['step']>5
  if mode=='camp':assert counts['gather'] and final['inventory']['berry']==r['phases'][0]['inventory']['berry']+2
  else:
   assert all(counts[k]>0 for k in ['swing','hit','hurt','enemy-windup','food']) and r['phases'][0]['kills']==19 and r['phases'][1]['player']['hp']==93 and r['phases'][2]['player']['hp']==100
   assert next(e for e in final['enemies'] if e['id']=='enemy-10')['hp']<=0
  names=['raw.json','pcm-analysis.json','inputs.jsonl','final-save.json','main-mix.webm','review-12s.wav',r['video'],*[p['image'] for p in r['phases']]]
  hashes={n:sha(d/n) for n in names}
  if collect:
   for n in names:shutil.copyfile(d/n,E/(mode+'-'+n))
  else:
   for n,digest in hashes.items():assert sha(E/(mode+'-'+n))==digest
  rows.append({'mode':mode,'duration':a['duration'],'contextSeconds':mix['seconds'],'durationDelta':a['durationDeltaSeconds'],'peak':a['full']['peak'],'rms':a['full']['rms'],'windows':a['windows'],'events':counts,'chunks':mix['chunks'],'bytes':mix['bytes'],'finalSaveSha256':sha(d/'final-save.json'),'profileSha256':sha(d/'browser-state.json'),'finalInventory':final['inventory'],'video':r['video'],'hashes':hashes})
 result={'rows':rows,'sources':{p:sha(R/p) for p in ['tools/observe_main_mix.js','tools/run_main_mix_review.mjs','tools/analyze_main_mix.mjs','tools/verify_main_mix.py']},'nativeMainCaptured':True,'microphoneUsed':False,'offlineSynthesisUsed':False,'auditionAccepted':False,'frameExactAvSyncAccepted':False,'physicalDeviceAccepted':False,'fullGoalComplete':False,'m5Complete':False}
 if collect:
  shutil.copyfile(R/'dist/main-mix-camp-decode-2026-11-05.log',E/'ffmpeg-decode-failed.txt')
  (E/'audit.json').write_text(json.dumps(result,indent=2)+'\n')
 else:assert load(E/'audit.json')==result
 print(json.dumps({'verified':True,'durations':[v['duration'] for v in rows],'nativeMainCaptured':True,'auditionAccepted':False,'m5Complete':False}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--collect',action='store_true');main(p.parse_args().collect)
