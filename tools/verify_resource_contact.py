"""Verify mineral-contact checkpoint evidence, keeping remaining M5 gaps explicit."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT/name).read_text())
def sha(name):
    return hashlib.sha256((ROOT/name).read_bytes()).hexdigest()

def verify():
    package=read('dist/tidelands-m5-2026-10-14-resource-contact.json')
    assert sha('dist/'+package['archive'])==package['archiveSha256']
    for name,record in package['files'].items():
        current='docs/LOCAL-DELIVERY.md' if name=='README.md' else name
        assert sha(current)==record['sha256'],current
    archived=read('docs/tidelands-m5-2026-10-14-resource-contact-verification.json')
    assert archived['passed'] and archived['checkedFiles']==47 and archived['archiveEntries']==48
    ui=read('docs/resource-contact-ui.json');steps=ui['normal']
    assert ui['nativeInput'] and not ui['newFixtureImported'] and not ui['runtimeStateEdited'] and not ui['console']
    counts=lambda s:{i['name']:int(i['count']) for i in s['inventory']}
    assert counts(steps[0])['石料']==2 and counts(steps[3])['石料']==5
    for s in steps: assert s['quest']=='群岛，再次相连' and s['hp']=='100'
    positions=[tuple(map(float,re.search(r'X (-?[\d.]+)，Z (-?[\d.]+)',s['coordinates']).groups())) for s in steps]
    assert positions[1][0]==positions[2][0] and positions[2][1]>positions[1][1]
    assert positions[4][0]<-81,'depleted footprint is traversable'
    assert steps[-1]['layout']=={'width':390,'height':844,'scrollWidth':390}
    forest=ui['forestScriptedFixture']
    assert forest['row']['frames']==180 and forest['row']['maxIntentOverwriteDegrees']==0 and forest['glError']==0
    assert 30<forest['row']['maxRenderedBearingStepDegrees']<34
    assert not ui['physicalMotionQualityPassed'] and not ui['fullGoalComplete']
    for name,total,passed,failed in [('focused',27,27,0),('full',195,195,0),('baseline',5,2,3)]:
        output=(ROOT/f'docs/resource-contact-{name}.txt').read_text()
        assert f'# tests {total}\n' in output and f'# pass {passed}\n' in output and f'# fail {failed}\n' in output
    assert sha('docs/current-journey-final-camp-save.json')=='0dc650a3ac8a83b62ea3e33c8797607f50d7f60b49b9a07e941e9040a196655e'
    save=read('docs/resource-contact-normal-save.json')
    assert save['quest']==6 and save['kills']==2 and len(save['buildings'])==1
    assert save['inventory']=={'wood':4,'stone':5,'fiber':4,'berry':2,'shell':0,'crystal':0,'axe':1,'sword':0,'meal':0}
    restored=subprocess.run(['node','--input-type=module','-e',"import {restore} from './src/game.js';import {readFileSync} from 'node:fs';console.log(JSON.stringify(restore(readFileSync('docs/resource-contact-normal-save.json','utf8'))));"],cwd=ROOT,check=True,capture_output=True,text=True)
    actual=json.loads(restored.stdout)
    assert actual['player']==save['player'] and actual['inventory']==save['inventory'] and actual['quest']==6
    assert positions[-1]==(round(save['player']['x'],1),round(save['player']['z'],1))
    old=read('dist/tidelands-m5-2026-10-12-movement-heading.json')
    assert sha('dist/'+old['archive'])==old['archiveSha256']
    images=sorted((ROOT/'docs').glob('resource-contact-*.jpg'));assert len(images)==5
    evidence=['docs/resource-contact-ui.json','docs/resource-contact-normal-save.json','docs/resource-contact-focused.txt','docs/resource-contact-full.txt','docs/resource-contact-baseline.txt','tests/resource-contact.test.js','src/game.js','src/resource-contact.js','src/camera.js','src/scene.js']
    report={'passed':True,'kind':'mineral-contact-functional-checkpoint','mineralContactFunctionalAccepted':True,'physicalMotionQualityPassed':False,'fullGoalComplete':False,'milestoneM5Complete':False,'completeNewPackageStarterToEndingReplayed':False,'ordinaryCompletedSaveMigrated':True,'package':package['archive'],'packageSha256':package['archiveSha256'],'runtimeFiles':47,'sourceModules':27,'unitTests':{'focused':27,'full':195,'baselineExpectedFailures':3},'viewedImagesSha256':{str(p.relative_to(ROOT)):sha(p.relative_to(ROOT)) for p in images},'evidenceSha256':{p:sha(p) for p in evidence},'finalSave':{'bytes':(ROOT/'docs/resource-contact-normal-save.json').stat().st_size,'sha256':sha('docs/resource-contact-normal-save.json'),'player':save['player'],'inventory':save['inventory'],'quest':6},'limits':ui['limits'],'remainingQuality':'Residual32.55-degree forest orbit, actors/NPC contact, whole environment identity, listening and final-source long-term/device/GPU review remain. Advance environment group while tracking non-blocking motion detail; fullM5 requires final audit.'}
    (ROOT/'docs/resource-contact-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':True,'mineralContactFunctionalAccepted':True,'quest':6,'stone':5,'fullGoalComplete':False},ensure_ascii=False))

if __name__=='__main__':verify()
