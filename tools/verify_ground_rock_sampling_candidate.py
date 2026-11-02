"""Verify the QA-only zero-rock-weight sampling experiment and preserved release."""
from pathlib import Path
import hashlib,json,zipfile

ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def sha(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()

def verify():
    report=read('docs/ground-rock-sampling-candidate.json')
    assert report['complete'] and not report['candidateIntegrated'] and not report['productionChanged']
    package=read('dist/tidelands-m5-2026-10-29-ground-support.json')
    archive='dist/'+package['archive']
    assert sha(archive)==package['archiveSha256']==report['runtimePackageSha256']
    with zipfile.ZipFile(ROOT/archive) as z:
        for path in ['src/ground-surface.js','src/scene.js']:
            digest=package['files'][path]['sha256']
            assert sha(path)==digest==report['sourceSha256'][path]
            assert hashlib.sha256(z.read('tidelands-local/'+path)).hexdigest()==digest
            assert sha('dist/tidelands-m5-2026-10-29-ground-support/tidelands-local/'+path)==digest
    assert report['disjoint']==0 and report['glError']==0 and report['timerBits']>=32
    assert report['groundStatus']=='ready' and report['rockStatus']=='ready'
    for path,digest in report['sourceSha256'].items():assert sha(path)==digest,path
    assert report['automatedTests']['passed']==385 and report['automatedTests']['failed']==0
    tests=(ROOT/'docs/ground-rock-sampling-tests.txt').read_text()
    assert '# tests 385' in tests and '# pass 385' in tests and '# fail 0' in tests
    candidate=read('docs/ground-rock-sampling-candidate.json')
    for name,place in candidate['pixelComparison']['locations'].items():
        assert place['pixels']==1920*945 and place['changed']==0 and place['maxChannelDelta']==0,name
        gpu=candidate['gpuQueries']['locations'][name]
        for mode in ['baseline','candidate']:
            assert gpu[mode]['samples']==48
            assert gpu[mode]['medianMs']>0 and gpu[mode]['p95Ms']>0 and gpu[mode]['maxMs']>=gpu[mode]['p95Ms'],(name,mode)
    print(json.dumps({'verified':True,'candidateIntegrated':False,'productionInputsPreserved':len(package['files']),'packageSha256':report['runtimePackageSha256'],'exactPixelLocations':len(candidate['pixelComparison']['locations']),'disjoint':report['disjoint'],'glError':report['glError'],'tests':385,'performancePromotion':'rejected: mixed location results; no consistent GPU improvement'},ensure_ascii=False))

if __name__=='__main__':verify()
