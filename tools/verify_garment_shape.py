"""Verify a bounded shared garment candidate; no complete art or motion claim."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE_SHA={'src/character.js': '290e2e33daf59fa6c0717ca6162ff989919cae3b947a6c21c9005e098e19649f', 'src/scene.js': '079e292b4b3ffefcb700dbdbed57d8d426506eb8033c8e1d159654d6f23f0c00', 'src/contact-shade.js': '850e369efa536ffae51afc404734459502362bb05875bb3a510a223dbc9029dc', 'tests/garment-shape.test.js': 'b8773ec6e75f50fa88ac93ae86d0d0ff6c4581f89f1fb3d627d919adcb0d497f', 'tests/character-art-review.html': '831a68ef7cf4d7474521eafe50e31f6383d3b21a8b785de46d0bd0a0a6d9f2a0', 'tests/character-adult-world.html': 'a56771cc896fa9a165bdd8df4665f0671db8b76e4df2016f0cacebdf6a78217f', 'tests/quality-gpu.html': '3881b9a5ac2dfb355a31b1cd49d477a4427879fe48e21ded291c921935c98b9c'}

def read(name):
    return json.loads((ROOT/name).read_text())

def sha(name):
    return hashlib.sha256((ROOT/name).read_bytes()).hexdigest()

def verify():
    assert all(sha(n)==h for n,h in SOURCE_SHA.items()), 'candidate source drift'
    for name,count in [('garment-shape-tests.txt',239),('garment-shape-focused.txt',30)]:
        text=(ROOT/'docs'/name).read_text()
        assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    red=(ROOT/'docs/garment-shape-red.txt').read_text()
    assert '# fail 2\n' in red and 'requires cloth coverage' in red
    before,after,world=map(read,['docs/garment-before.json','docs/garment-after.json','docs/garment-world.json'])
    assert not before['console'] and not after['console'] and not world['console']
    assert len(before['views'])==3 and len(after['views'])==4 and len(world['rows'])==5
    for b,a in zip(before['views'],after['views']):
        assert a['view']==b['view'] and a['windowViewport']==b['windowViewport']==[1280,720]
        assert b['visibleCharacterMeshes']==55 and a['visibleCharacterMeshes']==53
        assert b['triangles']==15403 and a['triangles']==15575 and a['glError']==b['glError']==0
        assert abs(a['visibleBounds']['min'][1]-b['visibleBounds']['min'][1])<1e-8
        assert abs(a['visibleBounds']['max'][1]-b['visibleBounds']['max'][1])<1e-8
    assert after['views'][-1]['color']=='keeper' and after['views'][-1]['glError']==0
    assert all(x['ready'] and x['glError']==0 for x in world['rows'])
    assert [x['gesture'] for x in world['rows'][:3]]==['idle','attack','gather']
    assert world['rows'][-1]['viewport']==[390,844] and world['rows'][-1]['time']==0
    gpu={}
    for device,size in [('desktop',[1920,1080]),('mobile',[390,844])]:
        data=read(f'docs/garment-gpu-{device}.json');s=data['sample']
        assert not data['console'] and s['complete'] and s['supported'] and not s['hidden'] and s['disjointCount']==0
        assert s['viewport']==s['canvasBuffer']==size and len(s['rows'])==5
        assert all(r['gpuMs']['samples']==len(r['gpuRawMs'])==60 and r['gpuMs']['p95']<16.67 and r['distanceMeters']>1 for r in s['rows'])
        assert s['rows'][1]['hits']>0
        gpu[device]={r['phase']:{'gpuP95Ms':r['gpuMs']['p95'],'cpuP95Ms':r['cpuFrameWorkMs']['p95'],'rafP95Ms':r['rafIntervalMs']['p95']} for r in s['rows']}
    package=read('dist/tidelands-m5-2026-10-17-grounding-budget-night.json')
    assert sha('dist/'+package['archive'])==package['archiveSha256']=='23156d79fcac9f7905f730a40fa73cc2fdb76f8b6a2778f2415e24011a53e5ba'
    changed=[n for n,e in package['files'].items() if sha('docs/LOCAL-DELIVERY.md' if n=='README.md' else n)!=e['sha256']]
    assert changed==['src/character.js','src/scene.js']
    assert sha('docs/grounding-budget-night-normal-save.json')=='7a61b0ebbd67a8a9cd8e778b40148dea0d36acbddccb011c78ebfa971d05c4ce'
    images=[f'docs/garment-{v}-{angle}.jpg' for v in ['before','after'] for angle in ['front','side','back']]+['docs/garment-after-keeper.jpg']+[f'docs/garment-world-{n}.jpg' for n in ['idle','attack','gather','night','mobile']]
    assert all((ROOT/n).read_bytes().startswith(b'\xff\xd8\xff') for n in images)
    evidence=['docs/garment-'+n+'.json' for n in ['before','after','world','gpu-desktop','gpu-mobile']]+['docs/garment-shape-'+n+'.txt' for n in ['red','focused','tests']]+images
    result={'passed':True,'candidateOnly':True,'sourceSha256':SOURCE_SHA,'fullTests':239,'focusedTests':30,'imagesReviewed':images,
            'evidenceSha256':{n:sha(n) for n in evidence},'gpu':gpu,'boundedGarmentShapeAccepted':True,'restJointCoverageAccepted':True,
            'candidateDelivered':False,'currentSourceLongRunAccepted':False,'completePhysicalContactAccepted':False,'audioListened':False,'realDevice':False,'m5Complete':False,'fullGoalComplete':False,
            'limits':'Shared coat/sleeves/trousers/pack shells, unchanged rig/face/boots/gameplay. Initial test probe was too broad and passed old seam, then narrowed to parent limb and outer seam; final RED one real rest-coverage failure and one absent new-surface contract, not two reproduced gameplay bugs. Static poses/camera fixture and short GPU movement/combat/swim only. Modular joint creases, blocky shoulders, mitten hands, dark faces and creature contact remain. Not physical cloth, whole journey, long-run, audio audition or phone proof. Old contact-shade audit locks previous character source and is historical for this combined candidate.'}
    (ROOT/'docs/garment-shape-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ['sourceSha256','evidenceSha256','imagesReviewed','gpu']},ensure_ascii=False))

if __name__=='__main__':
    verify()
