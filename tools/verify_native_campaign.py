"""Current ordinary campaign evidence; deliberately excludes uninterrupted/3A claims."""
import hashlib,json
from pathlib import Path
import zipfile
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'docs/native-campaign-2026-11-03'
def load(p):return json.loads(p.read_text())
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def verify():
 r=load(E/'raw.json');a=load(E/'audit.json');p=ROOT/'dist/native-campaign-2026-11-03';name=a['runtimePackage'];m=load(ROOT/'dist'/(name+'.json'))
 assert r['complete'] and r['reloadExact'] and not r.get('error') and r['logs']==[] and r['attempt']==3
 assert len(r['runs'])==2 and all('Native movement stalled' in x['error'] for x in r['runs'])
 assert "element is not visible" in r['checkpointError']
 assert not a['fullGoalComplete'] and not a['m5Complete'] and not a['uninterruptedJourneyAccepted'] and not a['audioListened']
 assert sha(ROOT/'dist'/(name+'.zip'))==m['archiveSha256']==a['packageSha256']=='ea99aa6904c0ea57560d1ce3874d7d469d9d2dcc5fe252d7cf82f5a5d27239d1'
 assert len(m['files'])==209
 with zipfile.ZipFile(ROOT/'dist'/(name+'.zip')) as z:
  for n,v in m['files'].items():
   assert sha(ROOT/('docs/LOCAL-DELIVERY.md' if n=='README.md' else n))==v['sha256']
   assert hashlib.sha256(z.read('tidelands-local/'+n)).hexdigest()==v['sha256']
   assert sha(ROOT/'dist'/name/'tidelands-local'/n)==v['sha256']
 rows=r['phases'];assert len(rows)==10 and [x['quest'] for x in rows]==[0,1,2,3,4,4,5,5,6,6]
 saves=[]
 for row in rows:
  assert sha(E/row['save'])==row['saveSha256'] and sha(p/row['image'])==row['imageSha256']
  assert not row['ui']['hidden'] and row['ui']['glError']==0
  saves.append(load(E/row['save']))
 assert saves[0]['kills']==0 and saves[0]['quest']==0 and saves[0]['inventory']['axe']==0 and not saves[0]['buildings']
 assert saves[2]['inventory']['axe']==1 and len(saves[3]['buildings'])==1
 assert {k:saves[7]['inventory'][k]-saves[8]['inventory'][k] for k in ['wood','stone','crystal']}==dict(wood=12,stone=8,crystal=3)
 final=load(E/'final-save.json');assert final['quest']==6 and final['kills']==13 and final['player']['hp']==67 and len(final['buildings'])==1
 assert set(['潮汐海岸','苍翠林地','雾岬高地']).issubset(final['discovered'])
 browser=load(p/'browser-state.json');stored=next(x['value'] for o in browser['origins'] for x in o['localStorage'] if x['name']=='tidelands-save-v1');assert stored==(E/'final-save.json').read_text()
 assert sha(E/'final-save.json')==a['finalSaveSha256'] and sha(p/'browser-state.json')==a['browserStateSha256']
 for v in a['videos']:assert sha(ROOT/v['path'])==v['sha256']
 for n,v in a['sources'].items():assert sha(ROOT/n)==v
 assert '# pass 0' in (E/'path-red.txt').read_text() and '# pass 1' in (E/'path-green.txt').read_text() and '# pass 404' in (E/'full-tests.txt').read_text()
 assert sha(ROOT/'docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
 print('Current native campaign: PASS (3 sessions, quest6/13 kills; full M5/3A open)')
if __name__=='__main__':verify()
