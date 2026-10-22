"""Verify confirmed-feedback UI evidence and bounded GPU ownership, without quality claims."""
import hashlib
import json
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
load=lambda p:json.loads((ROOT/p).read_text())

def verify():
    baseline=subprocess.check_output(['git','show','aa9aec2:src/impact-feedback.js'],cwd=ROOT)
    baseline_hash=hashlib.sha256(baseline).hexdigest()
    assert baseline.count(b'clear();geometry.dispose();material.dispose();')==1
    assert (ROOT/'src/impact-feedback.js').read_bytes()==baseline.replace(b'clear();geometry.dispose();material.dispose();',b'clear();mesh.dispose();geometry.dispose();material.dispose();')
    rows=load('docs/impact-feedback-browser.json');by={r['label']:r for r in rows}
    assert set(by)=={'miss-final','combat-final','stone-final','fiber-mobile-final'} and len(rows)==4
    for r in rows:
        assert r['authored'] and r['paused'] and r['glError']==0 and not r['console']
        for p,digest in r['sources'].items(): assert (baseline_hash if p=='src/impact-feedback.js' else sha(p))==digest,p
    for label,item,count,tool in [('stone-final','stone',3,'axe'),('fiber-mobile-final','fiber',2,'hand')]:
        r=by[label];assert len(r['events'])==1 and r['poolActive']==6
        event=r['events'][0];assert event['cue']['kind']==item and event['inventory'][item]==count and r['inventory'][item]==count
        assert r['plan']['equipped']==tool
        assert any(s['kind']=='gather' and s['time']==event['time'] and s['context']=='running' and s['after']>s['before'] for s in r['sounds'])
    r=by['combat-final'];assert len(r['events'])==1 and r['targetHp']==2 and r['poolActive']==6
    event=r['events'][0];assert event['cue']['kind']=='hit' and event['targetHp']==2
    assert any(s['kind']=='hit' and s['time']==event['time'] and s['after']>s['before'] and s['context']=='running' for s in r['sounds'])
    r=by['miss-final'];assert not r['events'] and r['poolActive']==0 and [s['kind'] for s in r['sounds']]==['swing']
    assert by['fiber-mobile-final']['viewport']==[390,844]
    for file,count in [('impact-disposal-focused.txt',14),('impact-disposal-full-tests.txt',282)]:
        text=(ROOT/'docs'/file).read_text();assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    red=(ROOT/'docs/impact-feedback-occlusion-red.txt').read_text();assert '# fail 1\n' in red and 'confirmed debris must not start beneath opaque crab shell' in red
    before=load('docs/impact-disposal-before.json');after=load('docs/impact-disposal-after.json')
    assert before['sourceSha256']==baseline_hash and not before['passed'] and len(before['rows'])==8
    assert all(r['created']==6 and r['deleted']==4 and r['glError']==0 for r in before['rows'])
    assert after['sourceSha256']==sha('src/impact-feedback.js') and after['passed'] and len(after['rows'])==8
    assert all(r['created']==r['deleted']==6 and r['beforeGeometries']==1 and r['afterGeometries']==0 and r['glError']==0 for r in after['rows'])
    files=['src/impact-feedback.js','src/main.js','src/scene.js','tests/impact-feedback.test.js','tests/impact-feedback-review.html','docs/impact-feedback-browser.json','docs/impact-feedback-red.txt','docs/impact-feedback-occlusion-red.txt','docs/impact-feedback-initial-full-tests.txt','docs/impact-feedback-focused.txt','docs/impact-feedback-full-tests.txt']
    files+=['tests/impact-disposal-review.html','docs/impact-disposal-before.json','docs/impact-disposal-after.json','docs/impact-disposal-red.txt','docs/impact-disposal-focused.txt','docs/impact-disposal-full-tests.txt']
    images=['docs/impact-feedback-'+r['label']+'.jpg' for r in rows]+['docs/impact-disposal-after.jpg']
    for p in images:assert (ROOT/p).read_bytes()[:2]==b'\xff\xd8'
    report={'verified':True,'fullGoalComplete':False,'runtimeEvidenceBaselineCommit':'aa9aec2','currentCleanupOnlyDelta':True,'nativeBufferCycles':8,'nativeBuffersPerCycleCreatedAndDeleted':6,'scope':'Native UI/audio/feedback observations use aa9aec2; current source differs only by adding mesh.dispose() inside the final cleanup callback, proven by exact byte comparison. Updated callback separately passes eight native six-create/six-delete GPU buffer cycles. No repeat of unchanged gameplay/animation/render code. QA pause panel/backdrop modified for inspection; mobile panel covers actor. Not blade collision, audition, normal campaign or final quality. GPU/endurance/delivery audited separately.','files':{p:sha(p) for p in files+images}}
    (ROOT/'docs/impact-feedback-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');return report

if __name__=='__main__':print(json.dumps(verify(),ensure_ascii=False,indent=2))
