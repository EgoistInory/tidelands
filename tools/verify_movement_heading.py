"""Audit held-input direction evidence, without certifying the full game."""
import hashlib
import json
import math
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NAME = 'tidelands-m5-2026-10-12-movement-heading'
def read(p):
    return json.loads((ROOT / p).read_text())
def sha(p):
    return hashlib.sha256((ROOT / p).read_bytes()).hexdigest()
def trajectory(trace, direction=None):
    frames = trace['frames']
    steps = [(b['x']-a['x'], b['z']-a['z']) for a,b in zip(frames, frames[1:])]
    steps = [v for v in steps if math.hypot(*v)>1e-6]
    assert steps and trace['released']
    if direction is None:
        direction = steps[0]
    n = math.hypot(*direction)
    errors = [math.acos(max(-1,min(1,(x*direction[0]+z*direction[1])/math.hypot(x,z)/n))) for x,z in steps]
    return {'frames':len(frames),'start':[frames[0]['x'],frames[0]['z']], 'end':[frames[-1]['x'],frames[-1]['z']], 'cameraTurnRadians':max(f['yawAfter'] for f in frames)-min(f['yawAfter'] for f in frames), 'maxMovementDeviationRadians':max(errors)}
def verify():
    review=read('docs/movement-heading-review.json')
    for p,h in review['sourceSha256'].items():
        assert sha(p)==h,p
    for p,h in review['imagesViewedSha256'].items():
        assert sha(p)==h,p
    baseline=read('docs/movement-heading-baseline-source.json')
    old=read('dist/tidelands-m5-2026-10-12-lighthouse.json')
    for p in ['src/main.js','src/scene.js','src/camera.js','src/pointer-controls.js']:
        assert baseline['files'][p]==old['files'][p]['sha256'],p
    assert sha('docs/movement-heading-baseline-harness.html')==baseline['files']['tests/movement-heading.html']
    b=read('docs/movement-heading-baseline-route-ui.json');f=read('docs/movement-heading-fixed-ui.json');m=read('docs/movement-heading-mobile-ui.json')
    for evidence in [b,f,m]:
        assert not evidence['console'] and not evidence['result']['stateSeeded'] and not evidence['result']['inputInjected']
    stats={}
    for label,evidence in [('baseline',b),('fixed',f)]:
        t=next(t for t in evidence['result']['traces'] if t['input']=='keyboard:s')
        yaw=t['frames'][0]['yawBefore'];stats[label]=trajectory(t,(math.sin(yaw),math.cos(yaw)))
        assert stats[label]['cameraTurnRadians']>1.5
    assert stats['baseline']['maxMovementDeviationRadians']>1.5
    assert stats['fixed']['maxMovementDeviationRadians']<1e-5
    t=m['result']['traces'][-1];assert t['input']=='joystick' and t['viewport']==[390,844] and m['actualPointerHold'] and not m['physicalTouchDevice']
    stats['mobile']=trajectory(t);assert stats['mobile']['cameraTurnRadians']>1.5 and stats['mobile']['maxMovementDeviationRadians']<1e-5
    release=read('docs/movement-heading-release-ui.json')['result']['traces'][-1]
    assert release['input']=='keyboard:w';yaw=release['frames'][0]['yawBefore']
    stats['releasedNewInput']=trajectory(release,(-math.sin(yaw),-math.cos(yaw)))
    assert stats['releasedNewInput']['maxMovementDeviationRadians']<1e-5
    for p,n in [('focused',12),('full',187)]:
        log=(ROOT/f'docs/movement-heading-{p}-tests.txt').read_text()
        assert re.search(rf'^# pass {n}$',log,re.M) and re.search(r'^# fail 0$',log,re.M)
    assert 'ERR_MODULE_NOT_FOUND' in (ROOT/'docs/movement-heading-red-tests.txt').read_text()
    log=(ROOT/'docs/movement-heading-package-tests.txt').read_text();assert 'Ran 4 tests' in log and '\nOK\n' in log
    syntax=read('docs/movement-heading-syntax.json')['checks']
    assert len(syntax)==5 and all(c['exitCode']==0 and not c['stderr'] for c in syntax)
    build=read(f'dist/{NAME}.json');check=read(f'docs/{NAME}-verification.json')
    assert check['passed'] and check['checkedFiles']==46 and build['archiveEntries']==47 and not build['fullGoalComplete']
    assert sha('dist/'+build['archive'])==build['archiveSha256']==check['archiveSha256']
    assert set(build['files'])-set(old['files'])=={'src/movement-heading.js'}
    assert {p for p in old['files'] if build['files'][p]!=old['files'][p]}=={'src/main.js','src/pointer-controls.js','README.md'}
    with zipfile.ZipFile(ROOT/'dist'/build['archive']) as z:
        assert z.testzip() is None and len(z.namelist())==47
        for p,entry in build['files'].items():
            assert hashlib.sha256(z.read('tidelands-local/'+p)).hexdigest()==entry['sha256']
            assert sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)==entry['sha256']
    assert len(review['historicalArchives'])==32
    for p,h in review['historicalArchives'].items():
        assert sha('dist/'+p)==h,p
    ordinary=read('docs/movement-heading-package-ui.json')
    assert ordinary['ordinaryGameRules'] and not ordinary['importedFixture'] and not ordinary['runtimeStateEdited'] and not ordinary['console']
    assert ordinary['importedOrdinarySave'] and sha(ordinary['importSource'])==ordinary['importSourceSha256']
    saved=read(ordinary['importSource'])
    assert saved['quest']==1 and saved['inventory']['wood']==4 and saved['inventory']['stone']==2
    assert ordinary['imported']['quest']=='荒野的第一把工具' and ordinary['afterAxe']['quest']=='在岛上安一个家'
    assert ordinary['desktop']['quest']=='林间的来信' and '建筑 1；击败 0' in ordinary['desktop']['coordinates']
    inv=lambda s:{e['name']:int(e['count']) for e in s['inventory']}
    assert inv(ordinary['imported'])['木材']==4 and inv(ordinary['imported'])['石料']==2
    assert inv(ordinary['afterAxe'])['木材']==0 and inv(ordinary['afterAxe'])['石料']==1 and inv(ordinary['afterAxe'])['石斧']==1
    assert inv(ordinary['campMaterials'])['木材']==6 and inv(ordinary['campMaterials'])['石料']==4
    assert inv(ordinary['desktop'])['木材']==1 and inv(ordinary['desktop'])['石料']==1 and inv(ordinary['desktop'])['石斧']==1
    assert ordinary['desktop']['coordinates']==ordinary['mobile']['coordinates']
    assert ordinary['desktop']['quest']==ordinary['mobile']['quest'] and ordinary['desktop']['inventory']==ordinary['mobile']['inventory']
    assert ordinary['mobile']['width']==ordinary['mobile']['scrollWidth']==390
    result={'kind':'held-movement-direction-evidence-audit','passed':True,'fullGoalComplete':False,'milestoneM5Complete':False,'trajectory':stats,'archive':{k:build[k] for k in ['archive','archiveBytes','archiveEntries','archiveSha256']},'historicalArchivesPreserved':32,'ordinaryFinal':ordinary['mobile'],'limits':review['limits'],'evidenceSha256':{str(p.relative_to(ROOT)):sha(p.relative_to(ROOT)) for p in sorted((ROOT/'docs').glob('movement-heading-*')) if p.name!='movement-heading-final-audit.json'}}
    (ROOT/'docs/movement-heading-final-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:result[k] for k in ['passed','trajectory','archive','historicalArchivesPreserved','fullGoalComplete']},ensure_ascii=False))
if __name__=='__main__':
    verify()
