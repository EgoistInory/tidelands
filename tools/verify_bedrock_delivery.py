"""Bind the finite bedrock delivery to actual runtime, saves and retained evidence."""
import argparse,hashlib,json,shutil,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'docs/bedrock-delivery-2026-11-05'
NAME='tidelands-m5-2026-11-05-bedrock'
def load(p):return json.loads(p.read_text())
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def verify(collect=False):
 m=load(ROOT/'dist'/(NAME+'.json'));archive=ROOT/'dist'/(NAME+'.zip');digest='b1900ba4c824a8d244892b3db37caa15cbda77ce51c089adea444116e584be31'
 assert sha(archive)==m['archiveSha256']==digest and archive.stat().st_size==170926310
 assert len(m['files'])==211
 extracted=ROOT/'dist'/NAME/'tidelands-local'
 with zipfile.ZipFile(archive) as z:
  assert len(z.namelist())==212 and z.testzip() is None
  for n,v in m['files'].items():
   assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if n=='README.md' else n))==v['sha256'],n
   assert hashlib.sha256(z.read('tidelands-local/'+n)).hexdigest()==v['sha256'],n
   assert sha(extracted/n)==v['sha256'],n
 render=load(E/'render-raw.json');assert render['complete'] and len(render['rows'])==15
 for p,d in render['sourceSha256'].items():assert sha(ROOT/p)==d,p
 raw_render=ROOT/'dist/bedrock-delivery-review-2026-11-05'
 for row in render['rows']:
  assert sha(raw_render/row['image'])==row['sha256'] and row['glError']==0 and row['worldUnchanged'] and row['stateUnchanged'] and all(row['authored'].values())
 for ctx in render['contexts']:
  assert not ctx['logs']
  if ctx.get('video'):assert sha(raw_render/ctx['video'])==ctx['videoSha256']
 for row in [r for r in render['rows'] if r['variant']=='current' and r['kind']=='static']:
  old=next(r for r in render['rows'] if r['variant']=='baseline' and r['site']==row['site'] and r['distance']==row['distance'] and r['width']==row['width'])
  for k in ['camera','lookAt','buffer']:assert old[k]==row[k]
 native_dir=ROOT/'dist/bedrock-native-campaign-2026-11-05';native=load(native_dir/'raw.json')
 assert native['complete'] and native['reloadExact'] and not native.get('error') and not native['logs']
 assert native['packageSha256']==digest and [r['quest'] for r in native['phases']]==[0,1,2,3,4,4,5,5,6,6]
 for row in native['phases']:
  assert sha(native_dir/row['save'])==row['saveSha256'] and sha(native_dir/row['image'])==row['imageSha256']
  assert not row['ui']['hidden'] and row['ui']['glError']==0
 first=load(native_dir/native['phases'][0]['save']);assert first['quest']==0 and first['kills']==0 and first['inventory']['axe']==0 and not first['buildings']
 before=load(native_dir/native['phases'][7]['save']);after=load(native_dir/native['phases'][8]['save'])
 assert {k:before['inventory'][k]-after['inventory'][k] for k in ['wood','stone','crystal']}==dict(wood=12,stone=8,crystal=3)
 final=load(native_dir/'final-save.json');assert final['quest']==6 and final['kills']>=2 and len(final['buildings'])==1
 stored=next(x['value'] for o in load(native_dir/'browser-state.json')['origins'] for x in o['localStorage'] if x['name']=='tidelands-save-v1');assert stored==(native_dir/'final-save.json').read_text()
 for run in [native,*native.get('runs',[])]:
  if run.get('video'):assert sha(native_dir/run['video'])==run['videoSha256']
 compat_dir=ROOT/'dist/bedrock-save-compat-2026-11-05';compat=load(compat_dir/'raw.json');assert compat['complete'] and len(compat['rows'])==3 and not compat.get('error')
 for p,d in compat['sources'].items():assert sha(ROOT/p)==d,p
 for row in compat['rows']:
  assert row['reloadExact'] and not row['logs'] and row['layout']['glError']==0 and row['moved']>.5
  assert row['layout']['width']==row['layout']['scrollWidth']==row['width']
  assert sha(compat_dir/(row['name']+'-save.json'))==row['saveSha256']
  for im in row['images']:assert sha(compat_dir/im['image'])==im['sha256']
 mobile=compat['rows'][1];assert mobile['after']['player']['hp']==100 and mobile['after']['inventory']['berry']==mobile['initial']['inventory']['berry']-1
 assert compat['rows'][2]['restToast'].endswith('生命和体力已恢复。')
 old=ROOT/'dist/tidelands-m5-2026-11-03-audio-interruption.zip';assert sha(old)=='ea99aa6904c0ea57560d1ce3874d7d469d9d2dcc5fe252d7cf82f5a5d27239d1'
 assert sha(ROOT/'docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
 assert '# pass 416' in (E/'full-tests.txt').read_text() and '# fail 0' in (E/'full-tests.txt').read_text()
 assert '# fail 3' in (E/'grade-red.txt').read_text() and '# pass 23' in (E/'integration-focused.txt').read_text()
 if collect:
  for p in [native_dir/'raw.json',*native_dir.glob('*-save.json')]:shutil.copyfile(p,E/('native-'+p.name))
  shutil.copyfile(compat_dir/'raw.json',E/'save-compat-raw.json')
  audit={'runtimePackage':NAME,'archiveSha256':digest,'bytes':archive.stat().st_size,'runtimeInputs':211,'archiveEntries':212,'ruleTests':416,'packagingTestsObserved':7,'campaignAttempt':native['attempt'],'campaignRespawns':native['respawns'],'campaignPhases':10,'finalSaveSha256':sha(native_dir/'final-save.json'),'finalQuest':final['quest'],'finalKills':final['kills'],'finalHp':final['player']['hp'],'finalTime':final['time'],'browserStateSha256':sha(native_dir/'browser-state.json'),'nativeVideo':native['video'],'nativeVideoSha256':native['videoSha256'],'nativeInputJournalSha256':sha(native_dir/'inputs.jsonl'),'renderImages':15,'compatCases':3,'sourceSha256':render['sourceSha256'],'fullGoalComplete':False,'m5Complete':False,'physicalDeviceAccepted':False,'audioListened':False,'currentGpuEnduranceAccepted':False,'wholeVideoReviewed':False}
  audit['qaSourceSha256']={p:sha(ROOT/p) for p in ['tools/journey_path.mjs','tools/run_bedrock_native_campaign.mjs','tools/run_bedrock_save_compat.mjs','tools/verify_bedrock_delivery.py','tests/bedrock-world.test.mjs','tests/terrain-step.test.mjs']}
  (E/'audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
 else:
  audit=load(E/'audit.json')
  for p,d in audit['qaSourceSha256'].items():assert sha(ROOT/p)==d,p
  assert sha(E/'native-raw.json')==sha(native_dir/'raw.json') and sha(E/'save-compat-raw.json')==sha(compat_dir/'raw.json')
  for row in native['phases']:assert sha(E/('native-'+row['save']))==row['saveSha256']
  assert sha(E/'native-final-save.json')==audit['finalSaveSha256']==sha(native_dir/'final-save.json')
  assert not audit['m5Complete'] and not audit['fullGoalComplete']
 print('Bedrock finite delivery: PASS (211 runtime inputs, 416 rules, current ordinary campaign and 3 save-import cases; M5/3A open)')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--collect',action='store_true');verify(parser.parse_args().collect)
