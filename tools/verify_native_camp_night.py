"""Audit an ordinary return/rest and naturally elapsed dusk-to-night continuation."""
import hashlib,json,math,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'docs/native-camp-night-2026-11-04'
def load(p):return json.loads(p.read_text())
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def verify():
 r=load(E/'raw.json');a=load(E/'audit.json');p=ROOT/'dist/native-camp-night-2026-11-04'
 assert r['complete'] and r['reloadExact'] and r['logs']==[] and not r.get('error') and not r.get('checkpointError')
 assert not a['fullGoalComplete'] and not a['m5Complete'] and not a['audioListened']
 assert a['initialSaveSha256']==sha(ROOT/'docs/campaign-mobile-2026-11-03/final-save.json')
 rows=r['phases'];assert [x['name'] for x in rows]==['00-continued-ending','01-camp-return','02-natural-night']
 for row in rows:
  assert row['quest']==6 and row['kills']==13 and row['inventory']['berry']==9 and len(row['buildings'])==1
  assert not row['ui']['hidden'] and row['ui']['glError']==0
  assert sha(E/row['save'])==row['saveSha256'] and sha(p/row['image'])==row['imageSha256']
 assert [x['player']['hp'] for x in rows]==[85,100,100]
 assert math.hypot(rows[0]['player']['x']-rows[1]['player']['x'],rows[0]['player']['z']-rows[1]['player']['z'])>80
 assert rows[1]['cycle']['label']=='黄昏' and rows[2]['cycle']['label']=='夜晚' and rows[2]['cycle']['daylight']==.04
 assert rows[2]['time']>rows[1]['time'] and r['nightWait']['observations'][-1]['cycle']['label']=='夜晚'
 assert rows[1]['player']['x']==rows[2]['player']['x'] and rows[1]['player']['z']==rows[2]['player']['z']
 assert sha(E/'final-save.json')==a['finalSaveSha256'] and sha(ROOT/a['browserStatePath'])==a['browserStateSha256']
 b=load(ROOT/a['browserStatePath']);stored=next(x['value'] for o in b['origins'] for x in o['localStorage'] if x['name']=='tidelands-save-v1');assert stored==(E/'final-save.json').read_text()
 assert sha(ROOT/a['videoPath'])==a['videoSha256']
 for n,v in a['sourceSha256'].items():assert sha(ROOT/n)==v
 name='tidelands-m5-2026-11-03-audio-interruption';m=load(ROOT/'dist'/(name+'.json'))
 assert sha(ROOT/'dist'/(name+'.zip'))==a['packageSha256']=='ea99aa6904c0ea57560d1ce3874d7d469d9d2dcc5fe252d7cf82f5a5d27239d1'
 assert len(m['files'])==209
 with zipfile.ZipFile(ROOT/'dist'/(name+'.zip')) as z:
  for n,v in m['files'].items():
   assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if n=='README.md' else n))==v['sha256']
   assert sha(ROOT/'dist'/name/'tidelands-local'/n)==v['sha256']
   assert hashlib.sha256(z.read('tidelands-local/'+n)).hexdigest()==v['sha256']
 print('Ordinary camp/night continuation: PASS (natural night, rest/reload; M5/3A open)')
if __name__=='__main__':verify()
