"""Bind enemy timing evidence to this immutable local checkpoint, not full 3A acceptance."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-16-enemy-windup'
def read(path): return json.loads((ROOT/path).read_text())
def sha(path): return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()

def verify():
    package=read(f'dist/{NAME}.json'); archive=read(f'docs/{NAME}-verification.json')
    assert archive['passed'] and archive['checkedFiles']==49 and archive['archiveEntries']==50
    assert sha('dist/'+package['archive'])==package['archiveSha256']
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as z:
        assert z.testzip() is None
        for name,record in package['files'].items():
            path='docs/LOCAL-DELIVERY.md' if name=='README.md' else name
            assert sha(path)==record['sha256'],path
            assert hashlib.sha256(z.read('tidelands-local/'+name)).hexdigest()==record['sha256']
            assert hashlib.sha256((Path(archive['extractedPath'])/name).read_bytes()).hexdigest()==record['sha256']
    for kind,total,passed,failed in [('red',6,1,5),('focused',53,53,0),('full',215,215,0)]:
        text=(ROOT/f'docs/enemy-windup-{kind}.txt').read_text()
        assert all(f'# {key} {n}\n' in text for key,n in [('tests',total),('pass',passed),('fail',failed)])
    assert 'Ran 4 tests' in (ROOT/'docs/enemy-windup-pack-tests.txt').read_text()
    assert '\nOK\n' in (ROOT/'docs/enemy-windup-pack-tests.txt').read_text()
    render=read('docs/enemy-windup-render.json');assert len(render['rows'])==10 and not render['console']
    for row in render['rows']:
        assert row['glError']==0
        assert row['hp']==(88 if row['type']=='boar' else 93) if row['phase']=='impact' else row['hp']==100
        if row['phase'] in ['warning','impact']:
            assert abs(row['bodyOffset']-.22)<.00001
            assert row['pose']['resolved']==(row['phase']=='impact')
        if row['phase'] in ['cancel','defeated']: assert row['pose'] is None
    native=read('docs/enemy-windup-native-ui.json');assert native['nativeInput'] and not native['ordinarySave'] and not native['console']
    boar=native['rows'][0]; warning=next(r for r in boar['records'] if r.get('danger')=='windup')
    impact=next(r for r in boar['records'] if r['hp']=='88')
    assert warning['hp']=='100' and warning['at']<impact['at'] and impact['danger']=='close'
    assert any(r['enemyHp']=='47 / 70' for r in boar['records'])
    crab=native['rows'][-1];assert all(r['hp']=='100' for r in crab['records'])
    assert sum(c['kind']=='enemy-windup' for c in crab['cues'])==1 and not any(c['kind']=='hit' for c in crab['cues'])
    assert crab['records'][-1]['paused'] and crab['records'][-1]['danger']=='near'
    audio=read('docs/enemy-warning-audio.json');assert not audio['console'] and not audio['listened'] and len(audio['rows'])==6
    for row in audio['rows']:
        assert row['finite'] and row['unclipped']
        assert row['peak']==0 and row['queued']==0 if row['mode'] in ['paused','muted'] else row['rms']>.0001
        if row['mode']=='busy': assert row['queued']==12
    ordinary=read('docs/enemy-windup-normal-ui.json');rows=ordinary['rows'];assert ordinary['nativeInput'] and not ordinary['fixtureImported'] and not ordinary['runtimeEdited'] and not ordinary['console']
    assert rows[0]['hp']=='100' and '击败 2' in rows[0]['coordinates']
    assert rows[2]['enemyHp']=='40 / 40' and rows[3]['hp']=='86' and rows[4]['combat']=='击败 1 个目标'
    assert rows[4]['enemyHidden'] and rows[-1]['hp']=='79' and '击败 3' in rows[-1]['coordinates']
    assert rows[-1]['viewport']==[390,844] and rows[-1]['scrollWidth']==390
    raw=read('docs/enemy-windup-normal-save.json');old=read('docs/actor-contact-normal-save.json')
    assert raw['quest']==6 and raw['kills']==old['kills']+1 and raw['player']['hp']==79
    assert raw['enemies'][4]['hp']==-6 and raw['buildings']==old['buildings']
    for key,n in old['inventory'].items(): assert raw['inventory'][key]==n+({'fiber':2,'berry':1}.get(key,0))
    assert sha('docs/enemy-windup-normal-save.json')==hashlib.sha256(Path(ordinary['download']).read_bytes()).hexdigest()
    subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import assert from 'node:assert/strict';import {restore,enemyAttackPose} from './src/game.js';const raw=JSON.parse(fs.readFileSync('docs/enemy-windup-normal-save.json','utf8')),s=restore(JSON.stringify(raw));assert.deepEqual(s.player,raw.player);assert.deepEqual(s.inventory,raw.inventory);assert.equal(enemyAttackPose(s,s.enemies[4]),null);"],cwd=ROOT,check=True)
    images=render['images']+native['images']+ordinary['images'];assert len(images)==9 and all((ROOT/p).stat().st_size>1000 for p in images)
    evidence=[f'docs/enemy-windup-{k}.txt' for k in ['red','focused','full','pack-tests']]+['docs/enemy-windup-render.json','docs/enemy-windup-native-ui.json','docs/enemy-warning-audio.json','docs/enemy-windup-normal-ui.json','docs/enemy-windup-normal-save.json']+images
    report={'passed':True,'archive':package['archive'],'archiveSha256':package['archiveSha256'],'runtimeFiles':49,'focusedTests':53,'fullTests':215,'renderedCases':10,'imagesReviewed':images,'evidenceSha256':{p:sha(p) for p in evidence},'ordinaryNativeCombat':True,'ordinaryKillsBefore':2,'ordinaryKillsAfter':3,'ordinaryHpAfter':79,'ordinarySaveSha256':sha('docs/enemy-windup-normal-save.json'),'mobileRestoreVerified':True,'audioListeningVerified':False,'fullCurrentMainPathReplayed':False,'m5Complete':False,'fullGoalComplete':False,'limits':'Fixed-dt fixture poses, native fixture feedback, offline waveform routing, and one ordinary crab combat/save/reload. No whole-scene visual, continuous endurance, listening, real-device or GPU acceptance.'}
    (ROOT/'docs/enemy-windup-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['evidenceSha256','imagesReviewed']},ensure_ascii=False))

if __name__=='__main__': verify()
