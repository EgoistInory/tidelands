"""Verify a bounded continuation of the actual ordinary ending; no full mobile claim."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'docs/campaign-mobile-2026-11-03'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def verify():
 r=json.loads((E/'raw.json').read_text());a=json.loads((E/'audit.json').read_text());p=ROOT/'dist/campaign-mobile-2026-11-03'
 assert r['complete'] and r['reloadExact'] and r['logs']==[]
 assert r['initialSaveSha256']==sha(ROOT/'docs/native-campaign-2026-11-03/final-save.json')
 assert a['sourceSha256']==sha(ROOT/'tools/run_campaign_mobile.mjs') and not a['fullGoalComplete']
 x,y=r['before']['player'],r['afterJoystick']['player'];assert ((x['x']-y['x'])**2+(x['z']-y['z'])**2)**.5>.5
 assert r['afterFood']['inventory']['berry']==9 and r['afterFood']['player']['hp']==85
 assert r['saved']['quest']==6 and r['saved']['kills']==13 and len(r['saved']['buildings'])==1
 assert r['layout']==dict(width=390,scrollWidth=390,hidden=False,glError=0)
 for image in r['images']:assert sha(p/image['image'])==image['sha256']
 assert sha(p/'browser-state.json')==a['browserStateSha256']
 browser=json.loads((p/'browser-state.json').read_text());stored=next(x['value'] for o in browser['origins'] for x in o['localStorage'] if x['name']=='tidelands-save-v1');assert stored==(E/'final-save.json').read_text()
 print('Ending mobile continuation: PASS (390 browser controls; night/M5/3A open)')
if __name__=='__main__':verify()
