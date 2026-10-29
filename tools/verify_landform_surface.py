"""Verify the finite, rejected landform surface candidate and preserved runtime."""
from pathlib import Path
import hashlib,json,math,zipfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    package=read('dist/tidelands-m5-2026-10-29-ground-support.json');assert len(package['files'])==209
    assert sha('dist/'+package['archive'])==package['archiveSha256']=='ee606c25629a7b9f704fc504d661abea31264244b52027a9530253c60ca8301f'
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as z:
        assert len(z.infolist())==210
        for p,v in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)==v['sha256'],p
            assert hashlib.sha256(z.read('tidelands-local/'+p)).hexdigest()==v['sha256'],p
            assert sha('dist/tidelands-m5-2026-10-29-ground-support/tidelands-local/'+p)==v['sha256'],p
    assert sha('docs/beacon-footing-normal-save.json')=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    rows=read('docs/landform-surface-observations.json');assert len(rows)==24;groups={}
    for r in rows:
        assert r['worldUnchanged'] and r['stateUnchanged'] and r['geometryUnchanged'] and r['landscapeEnabled'] and r['rockChannelsReady']==1 and r['glError']==0
        assert r['authoredCast'] and r['inland'] and r['coastal'] and r['attributeBytes']==1236492
        with Image.open(ROOT/r['screenshot']) as im:im.load();assert im.size==(1280,720)
        groups.setdefault((r['site'],r['distance']),{})[r['variant']]=r
    assert len(groups)==12
    for pair in groups.values():
        a,b=pair['old'],pair['candidate']
        for k in ['camera','lookAt','player','time','render','buffer','viewport']:assert a[k]==b[k],k
    first=read('docs/landform-surface-first-clone-observations.json');assert len(first)==2
    for r in first:
        with Image.open(ROOT/r['screenshot']) as im:im.load()
    assert read('docs/landform-surface-console.json')==[]
    perf={}
    for variant in ['old','candidate']:
        r=read('docs/landform-surface-gpu-'+variant+'.json')
        assert r['complete'] and r['supported'] and not r['error'] and not r['hidden'] and r['disjoint']==0
        assert len(r['frames'])>=900 and len(r['gpuRawMs'])==math.ceil(len(r['frames'])/8)>=110
        assert r['frames'][-1]['at']-r['frames'][0]['at']>15000
        assert all(isinstance(v,(int,float)) and math.isfinite(v) and v>0 for v in r['gpuRawMs'])
        assert r['scene']['variant']==variant and r['scene']['site']=='highland' and r['scene']['distance']=='middle'
        for k in ['camera','lookAt','player','time','buffer','viewport']:assert r['scene'][k]==r['after'][k],k
        assert r['scene']['glError']==r['after']['glError']==0
        perf[variant]={k:r[k] for k in ['gpuMs','renderCpuMs','rafIntervalMs']}
    a,b=[read('docs/landform-surface-gpu-'+v+'.json') for v in ['old','candidate']]
    for k in ['camera','lookAt','player','time','buffer','viewport','render']:assert a['scene'][k]==b['scene'][k],k
    assert '# pass 381' in (ROOT/'docs/landform-surface-tests.txt').read_text()
    assert '# fail 2' in (ROOT/'docs/landform-surface-red.txt').read_text()
    assert 'GROUND_LANDSCAPE' in (ROOT/'docs/landform-surface-defines-red.txt').read_text()
    for site in ['highland','coast','forest','shoal']:
        with Image.open(ROOT/'docs'/('landform-surface-contact-'+site+'.jpg')) as im:im.load();assert im.size==(1280,1020)
    review=read('docs/landform-surface-code-review.json');assert review['importantFindings']==0
    sources=['tests/landform-surface-candidate.js','tests/landform-surface.test.js','tests/landform-surface-review.html']
    report={'verified':True,'accepted':False,'productionIntegrated':False,'packaged':False,'fullGoalComplete':False,'milestoneM5Complete':False,'productionInputsPreserved':209,'productionArchiveSha256':package['archiveSha256'],'nativePairs':12,'visualDecisionPairs':11,'occludedPairs':[['forest','near']],'firstCloneFailureImagesPreserved':2,'attributeBytes':1236492,'sourceHashes':{p:sha(p) for p in sources},'perf':perf,'candidateToOldGpuP95Ratio':perf['candidate']['gpuMs']['p95']/perf['old']['gpuMs']['p95'],'testPasses':381,'importantCodeReviewFindings':0,'wetZonePixelsUnchangedProven':False,'reason':'Continuous weather tint and rock UV warping only shift tone. Bare hill form, repeated landscape composition and primitive upland vegetation remain; stop this tuning route. Forest near pair is obscured by a branch and excluded from visual benefit judgment.','scope':'Fixed authored WorldView diagnostic; native static GPU queries, no main-loop, ordinary movement/combat/save, dynamic wind, mobile/device, VRAM/endurance, audio or final3A evidence.'}
    (ROOT/'docs/landform-surface-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':verify()
