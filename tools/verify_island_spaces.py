"""Verify island-space delivery, its actual browser evidence and immutable source boundary."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-16-island-spaces'
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    package=read(f'dist/{NAME}.json');delivery=read(f'docs/{NAME}-verification.json')
    assert delivery['passed'] and delivery['checkedFiles']==51 and delivery['archiveEntries']==52
    assert sha('dist/'+package['archive'])==package['archiveSha256']
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as z:
        assert z.testzip() is None
        for name,record in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)==record['sha256'],name
            assert hashlib.sha256(z.read('tidelands-local/'+name)).hexdigest()==record['sha256']
            assert hashlib.sha256((Path(delivery['extractedPath'])/name).read_bytes()).hexdigest()==record['sha256']
    for name,total,passed,failed in [('focused',29,29,0),('full',221,221,0),('baseline',4,1,3)]:
        text=(ROOT/f'docs/ruin-space-{name}.txt').read_text();assert all(f'# {k} {v}\n' in text for k,v in [('tests',total),('pass',passed),('fail',failed)])
    text=(ROOT/'docs/ruin-space-pack-tests.txt').read_text();assert 'Ran 4 tests' in text and '\nOK\n' in text
    render=read('docs/ruin-space-render.json');assert len(render['rows'])==5 and not render['console']
    assert all(r['glError']==0 and r['boxes']==47 for r in render['rows'])
    assert '群岛不因海峡' in render['rows'][0]['message']
    support,opening=render['rows'][2:4];assert support['frames']==opening['frames']==90
    assert support['player'][1]>-268.4 and opening['player'][1]>-269 and opening['near']=='ruin'
    assert render['rows'][-1]['viewport']==[390,844]
    native=read('docs/ruin-space-native.json');assert native['nativeInput'] and native['fixture'] and not native['console'] and '群岛不因海峡' in native['toast']
    normal=read('docs/island-spaces-normal-ui.json');assert normal['nativeInput'] and not normal['fixtureImported'] and not normal['runtimeEdited'] and not normal['console']
    assert normal['rows'][0]['coordinates']!=normal['rows'][1]['coordinates']
    assert all(r['hp']=='79' and r['quest']=='群岛，再次相连' and '击败 3' in r['coordinates'] for r in normal['rows'])
    assert normal['rows'][-1]['viewport']==[390,844] and normal['rows'][-1]['scrollWidth']==390
    raw,old=read('docs/island-spaces-normal-save.json'),read('docs/enemy-windup-normal-save.json')
    assert raw['inventory']==old['inventory'] and raw['buildings']==old['buildings'] and raw['kills']==3 and raw['quest']==6
    assert sha('docs/island-spaces-normal-save.json')==hashlib.sha256(Path(normal['download']).read_bytes()).hexdigest()
    assert sha('docs/enemy-windup-normal-save.json')=='3491e7cd995f9a1c473117c19659d337cccc4421644d6b2e5c601352e321eb18'
    subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import assert from 'node:assert/strict';import {restore} from './src/game.js';const raw=JSON.parse(fs.readFileSync('docs/island-spaces-normal-save.json','utf8')),s=restore(JSON.stringify(raw));assert.deepEqual(s.player,raw.player);assert.deepEqual(s.inventory,raw.inventory);assert.equal(s.quest,6);assert.equal(s.kills,3);assert.equal(s.enemies[4].hp,-6);"],cwd=ROOT,check=True)
    gpu={}
    for mode,buffer in [('desktop',[1920,1080]),('mobile',[390,844])]:
        e=read(f'docs/island-spaces-gpu-{mode}.json');s=e['sample'];assert not e['console'] and s['complete'] and not s['hidden'] and s['disjointCount']==0 and s['canvasBuffer']==buffer
        assert len(s['rows'])==5 and all(len(r['gpuRawMs'])==60 and all(n>0 for n in r['gpuRawMs']) for r in s['rows'])
        gpu[mode]={r['phase']:r['gpuMs']['p95'] for r in s['rows']}
    images=[str(Path(p).relative_to(ROOT)) for p in render['images']]+['docs/ruin-space-native.png']+normal['images'];assert len(images)==8
    evidence=['docs/ruin-space-render.json','docs/ruin-space-native.json','docs/island-spaces-normal-ui.json','docs/island-spaces-normal-save.json','docs/island-spaces-gpu-desktop.json','docs/island-spaces-gpu-mobile.json']+images+[f'docs/ruin-space-{name}.txt' for name in ['focused','full','baseline','pack-tests']]
    report={'passed':True,'archive':package['archive'],'archiveSha256':package['archiveSha256'],'runtimeFiles':51,'fullTests':221,'focusedTests':29,'historicalBaselineFailures':3,'currentImagesReviewed':images,'evidenceSha256':{p:sha(p) for p in evidence},'ordinarySaveSha256':sha('docs/island-spaces-normal-save.json'),'currentFullCanvasGpuP95Ms':gpu,'previousTreeNightCandidate':'docs/island-night-candidate.json (historical source762355e, ten prior reviewed images; not current ruin pictures)','ordinaryRuinVisit':False,'nativeRuinFixtureInteraction':True,'newFullMainPathReplayed':False,'newEnduranceReplayed':False,'audioListening':False,'realMobileHardware':False,'m5Complete':False,'fullGoalComplete':False,'limits':'Merged stone ruin access/body/camera, prior tree/night subgroup, native isolated stele and ordinary q6 move/download/390 restore. Full-canvas GPU queries are fixture samples without audio/HUD, not endurance/VRAM/physical mobile or complete 3A acceptance.'}
    (ROOT/'docs/island-spaces-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['currentImagesReviewed','evidenceSha256']},ensure_ascii=False))
if __name__=='__main__':verify()
