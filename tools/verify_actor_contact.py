"""Audit the actor body-contact batch; animation, audio and full M5 remain separate."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
def read(name): return json.loads((ROOT/name).read_text())
def sha(name): return hashlib.sha256((ROOT/name).read_bytes()).hexdigest()

def verify():
    package=read('dist/tidelands-m5-2026-10-15-actor-contact.json')
    archived=read('docs/tidelands-m5-2026-10-15-actor-contact-verification.json')
    assert archived['passed'] and archived['checkedFiles']==49 and archived['archiveEntries']==50
    assert sha('dist/'+package['archive'])==package['archiveSha256']
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as z:
        assert z.testzip() is None
        for name,record in package['files'].items():
            path='docs/LOCAL-DELIVERY.md' if name=='README.md' else name
            assert sha(path)==record['sha256'],path
            assert hashlib.sha256(z.read('tidelands-local/'+name)).hexdigest()==record['sha256']
    for name,total,passed,failed in [('focused',44,44,0),('full',208,208,0),('baseline',10,2,8)]:
        text=(ROOT/f'docs/actor-contact-{name}.txt').read_text()
        assert f'# tests {total}\n' in text and f'# pass {passed}\n' in text and f'# fail {failed}\n' in text
    render=read('docs/actor-contact-render-ui.json');rows=render['rows']
    assert len(rows)==7 and not render['console'] and all(r['frames']==240 and r['glError']==0 for r in rows)
    assert 1.05<=rows[0]['npcDistance']<1.2
    for r in rows[1:]:
        assert r['maxEnemyStep']<=4.2/60+1e-8
        assert all(e['distance']>=e['contactDistance']-1e-8 for e in r['enemies'])
    assert rows[1]['hp']==64 and rows[3]['hp']==86
    for before,impact in [(rows[1],rows[2]),(rows[3],rows[4])]:
        assert impact['enemies'][0]['hp']==before['enemies'][0]['hp']-23
        assert impact['result']['hits']==['contact-review-a']
    a,b=rows[5]['enemies'];assert ((a['x']-b['x'])**2+(a['z']-b['z'])**2)**.5>=4.39
    assert rows[6]['viewport']==[390,844]
    normal=read('docs/actor-contact-normal-ui.json');hud=[r['hud'] for r in normal['rows']]
    assert normal['nativeInput'] and not normal['fixtureImported'] and not normal['runtimeEdited'] and not normal['console']
    assert hud[0]['coordinates']==hud[1]['coordinates'] and '阿岚：归航灯塔又亮起来了' in hud[1]['toast']
    assert all(h['quest']=='群岛，再次相连' and h['hp']=='100' for h in hud)
    assert hud[2]['viewport']==[390,844] and hud[2]['scrollWidth']==390
    raw=read('docs/actor-contact-normal-save.json');old=read('docs/environment-normal-save.json')
    assert raw['quest']==6 and raw['kills']==2 and len(raw['buildings'])==1 and raw['inventory']==old['inventory']
    assert 1.05<((raw['player']['x']+59)**2+(raw['player']['z']-94)**2)**.5<1.2
    coords=tuple(map(float,re.search(r'X (-?[\d.]+)，Z (-?[\d.]+)',hud[2]['coordinates']).groups()))
    assert coords==(round(raw['player']['x'],1),round(raw['player']['z'],1))
    result=subprocess.run(['node','--input-type=module','-e',"import {restore} from './src/game.js';import {readFileSync} from 'node:fs';console.log(JSON.stringify(restore(readFileSync('docs/actor-contact-normal-save.json','utf8'))));"],cwd=ROOT,check=True,capture_output=True,text=True)
    restored=json.loads(result.stdout)
    for key in ['player','inventory','quest','buildings','kills']: assert restored[key]==raw[key]
    assert sha('docs/environment-normal-save.json')=='4e99396f1228d5cbff11bada479a4b6f4f10a3cd7d4fbc54c612b75a47534914'
    previous=read('dist/tidelands-m5-2026-10-15-environment.json');assert sha('dist/'+previous['archive'])==previous['archiveSha256']
    images=sorted((ROOT/'docs').glob('actor-contact-*.png'));assert len(images)==9
    inputs=['src/game.js','src/main.js','src/actor-contact.js','src/resource-contact.js','tests/actor-contact.test.js','tests/actor-contact.html','docs/actor-contact-render-ui.json','docs/actor-contact-normal-ui.json','docs/actor-contact-normal-save.json','docs/actor-contact-focused.txt','docs/actor-contact-full.txt','docs/actor-contact-baseline.txt']
    report={'passed':True,'kind':'actor-body-contact-functional-checkpoint','localDeliveryVerified':True,'actorBodyContactAccepted':True,'milestoneM5Complete':False,'fullGoalComplete':False,'newPackageFullMainPathReplayed':False,'package':package['archive'],'packageSha256':package['archiveSha256'],'runtimeFiles':49,'unitTests':{'focused':44,'full':208,'oldPackageExpectedFailures':8},'imagesActuallyViewedSha256':{str(p.relative_to(ROOT)):sha(p.relative_to(ROOT)) for p in images},'sourceAndEvidenceSha256':{p:sha(p) for p in inputs},'ordinarySave':{'path':'docs/actor-contact-normal-save.json','bytes':(ROOT/'docs/actor-contact-normal-save.json').stat().st_size,'sha256':sha('docs/actor-contact-normal-save.json'),'player':raw['player'],'quest':6,'inventory':raw['inventory']},'limits':['Circles/expanded mineral boxes are conservative horizontal footprints, not triangle collision or whole-body animation acceptance.','Seven rendered rows use explicit enemy/weapon/position fixtures and fixed-dt; actual ordinary native check is NPC blocking/dialogue/save recovery, not a new ordinary combat journey.','390x844 is browser viewport only; no real-device, listening, final performance or GPU proof.','Crowd recovery is bounded movement near the player, not world-wide navigation/pathfinding; complex corners remain for final quality review.','Enemy damage still precedes the middle of its rendered lunge; telegraph/timing and audio feedback remain next, alongside residual camera and environment quality.']}
    (ROOT/'docs/actor-contact-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':True,'actorBodyContactAccepted':True,'runtimeFiles':49,'quest':6,'fullGoalComplete':False}))

if __name__=='__main__':verify()
